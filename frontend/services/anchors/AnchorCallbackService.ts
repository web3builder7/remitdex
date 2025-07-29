import express from 'express';
import axios from 'axios';
import { EventEmitter } from 'events';

// Anchor Platform Callbacks API implementation
// Handles real-time rate updates and transaction status callbacks

export interface RateRequest {
  type: 'indicative' | 'firm';
  sell_asset: string;
  buy_asset: string;
  sell_amount?: string;
  buy_amount?: string;
  country_code?: string;
  client_id?: string;
  expire_after?: string;
}

export interface RateResponse {
  rate: {
    id: string;
    price: string;
    sell_amount: string;
    buy_amount: string;
    fee: {
      total: string;
      asset: string;
      details?: Array<{
        name: string;
        description?: string;
        amount: string;
      }>;
    };
    expire_at?: string;
  };
}

export interface CustomerCallback {
  id: string;
  account?: string;
  memo?: string;
  memo_type?: string;
  type?: 'sep31-sender' | 'sep31-receiver';
  callback_url?: string;
  lang?: string;
}

export class AnchorCallbackService extends EventEmitter {
  private app: express.Application;
  private rateCache: Map<string, RateResponse>;
  private rateCacheTTL = 60000; // 60 seconds
  private anchorRateEndpoints: Map<string, string>;

  constructor() {
    super();
    this.app = express();
    this.rateCache = new Map();
    
    // Anchor rate callback endpoints
    this.anchorRateEndpoints = new Map([
      ['CLICK_PHP', 'https://api.clickpeso.com/callbacks/rate'],
      ['COWRIE_NGN', 'https://api.cowrie.exchange/callbacks/rate'],
      ['VIBRANT_USD', 'https://vibrant.stellar.org/callbacks/rate'],
      ['SETTLE_EUR', 'https://api.settle.network/callbacks/rate']
    ]);

    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.use(express.json());

    // GET /rate endpoint - called by anchors to get exchange rates
    this.app.get('/callbacks/rate', async (req, res) => {
      try {
        const rateRequest: RateRequest = {
          type: req.query.type as 'indicative' | 'firm' || 'indicative',
          sell_asset: req.query.sell_asset as string,
          buy_asset: req.query.buy_asset as string,
          sell_amount: req.query.sell_amount as string,
          buy_amount: req.query.buy_amount as string,
          country_code: req.query.country_code as string,
          client_id: req.query.client_id as string,
          expire_after: req.query.expire_after as string
        };

        const rate = await this.calculateRate(rateRequest);
        res.json(rate);
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });

    // POST /customer endpoint - KYC status updates
    this.app.post('/callbacks/customer', async (req, res) => {
      try {
        const callback: CustomerCallback = req.body;
        this.emit('customer-update', callback);
        res.json({ success: true });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });

    // POST /transaction endpoint - transaction status updates
    this.app.post('/callbacks/transaction/:id', async (req, res) => {
      try {
        const transactionId = req.params.id;
        const update = req.body;
        this.emit('transaction-update', { id: transactionId, ...update });
        res.json({ success: true });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });
  }

  // Calculate exchange rate based on current market conditions
  private async calculateRate(request: RateRequest): Promise<RateResponse> {
    const cacheKey = `${request.sell_asset}-${request.buy_asset}-${request.sell_amount || request.buy_amount}`;
    
    // Check cache first
    const cached = this.rateCache.get(cacheKey);
    if (cached && Date.now() - parseInt(cached.rate.id) < this.rateCacheTTL) {
      return cached;
    }

    // Calculate rate based on asset pair
    let rate = 1;
    let fee = 0;
    
    // Determine corridor and calculate rate
    if (request.sell_asset === 'stellar:USDC' && request.buy_asset === 'iso4217:PHP') {
      rate = 56.50; // USD to PHP
      fee = 0.005; // 0.5%
    } else if (request.sell_asset === 'stellar:USDC' && request.buy_asset === 'iso4217:NGN') {
      rate = 1520.00; // USD to NGN
      fee = 0.006; // 0.6%
    } else if (request.sell_asset === 'stellar:USDC' && request.buy_asset === 'iso4217:ARS') {
      rate = 850.00; // USD to ARS
      fee = 0.007; // 0.7%
    } else if (request.sell_asset === 'stellar:USDC' && request.buy_asset === 'iso4217:EUR') {
      rate = 0.92; // USD to EUR
      fee = 0.004; // 0.4%
    }

    // Apply spread for firm quotes
    if (request.type === 'firm') {
      rate = rate * 0.998; // 0.2% spread
    }

    // Calculate amounts
    let sellAmount: number;
    let buyAmount: number;

    if (request.sell_amount) {
      sellAmount = parseFloat(request.sell_amount);
      buyAmount = sellAmount * rate * (1 - fee);
    } else if (request.buy_amount) {
      buyAmount = parseFloat(request.buy_amount);
      sellAmount = buyAmount / (rate * (1 - fee));
    } else {
      throw new Error('Either sell_amount or buy_amount must be provided');
    }

    const feeAmount = sellAmount * fee;

    const response: RateResponse = {
      rate: {
        id: Date.now().toString(),
        price: rate.toFixed(4),
        sell_amount: sellAmount.toFixed(2),
        buy_amount: buyAmount.toFixed(2),
        fee: {
          total: feeAmount.toFixed(2),
          asset: request.sell_asset,
          details: [
            {
              name: 'service_fee',
              description: 'RemitDEX service fee',
              amount: (feeAmount * 0.6).toFixed(2) // 60% of fee
            },
            {
              name: 'anchor_fee',
              description: 'Anchor processing fee',
              amount: (feeAmount * 0.4).toFixed(2) // 40% of fee
            }
          ]
        }
      }
    };

    // Set expiration for firm quotes
    if (request.type === 'firm') {
      const expireMinutes = request.expire_after ? parseInt(request.expire_after) : 5;
      const expireAt = new Date(Date.now() + expireMinutes * 60000);
      response.rate.expire_at = expireAt.toISOString();
    }

    // Cache the rate
    this.rateCache.set(cacheKey, response);

    return response;
  }

  // Get live rate from anchor
  async getAnchorRate(
    anchorCode: string,
    sellAsset: string,
    buyAsset: string,
    amount: string,
    type: 'sell' | 'buy' = 'sell'
  ): Promise<RateResponse | null> {
    const endpoint = this.anchorRateEndpoints.get(anchorCode);
    if (!endpoint) return null;

    try {
      const params: any = {
        type: 'firm',
        sell_asset: sellAsset,
        buy_asset: buyAsset
      };

      if (type === 'sell') {
        params.sell_amount = amount;
      } else {
        params.buy_amount = amount;
      }

      const response = await axios.get(endpoint, { params });
      return response.data;
    } catch (error) {
      console.error(`Failed to get rate from ${anchorCode}:`, error);
      return null;
    }
  }

  // Compare rates from multiple anchors
  async getBestRate(
    sellAsset: string,
    buyAsset: string,
    amount: string,
    type: 'sell' | 'buy' = 'sell'
  ): Promise<{
    anchor: string;
    rate: RateResponse;
  } | null> {
    const ratePromises = Array.from(this.anchorRateEndpoints.keys()).map(
      async (anchorCode) => {
        const rate = await this.getAnchorRate(anchorCode, sellAsset, buyAsset, amount, type);
        return rate ? { anchor: anchorCode, rate } : null;
      }
    );

    const rates = (await Promise.all(ratePromises)).filter(r => r !== null) as Array<{
      anchor: string;
      rate: RateResponse;
    }>;

    if (rates.length === 0) return null;

    // Find best rate (highest buy amount for sell orders, lowest sell amount for buy orders)
    return rates.reduce((best, current) => {
      if (type === 'sell') {
        // For sell orders, we want the highest buy amount
        return parseFloat(current.rate.rate.buy_amount) > parseFloat(best.rate.rate.buy_amount)
          ? current
          : best;
      } else {
        // For buy orders, we want the lowest sell amount
        return parseFloat(current.rate.rate.sell_amount) < parseFloat(best.rate.rate.sell_amount)
          ? current
          : best;
      }
    });
  }

  // Subscribe to rate updates
  subscribeToRateUpdates(
    anchorCode: string,
    assetPair: { sell: string; buy: string },
    callback: (rate: RateResponse) => void
  ) {
    const eventName = `rate-update-${anchorCode}-${assetPair.sell}-${assetPair.buy}`;
    this.on(eventName, callback);

    // Start polling for rate updates
    const pollInterval = setInterval(async () => {
      const rate = await this.getAnchorRate(
        anchorCode,
        assetPair.sell,
        assetPair.buy,
        '100', // Default amount for rate checking
        'sell'
      );
      
      if (rate) {
        this.emit(eventName, rate);
      }
    }, 30000); // Poll every 30 seconds

    // Return unsubscribe function
    return () => {
      this.off(eventName, callback);
      clearInterval(pollInterval);
    };
  }

  // Start the callback server
  start(port: number = 3001) {
    this.app.listen(port, () => {
      console.log(`Anchor callback service listening on port ${port}`);
    });
  }

  // Helper to format asset codes
  formatAssetCode(asset: string): string {
    // stellar:USDC -> Stellar USDC
    // iso4217:PHP -> Philippine Peso
    if (asset.startsWith('stellar:')) {
      return asset.replace('stellar:', '') + ' on Stellar';
    } else if (asset.startsWith('iso4217:')) {
      const currencyNames: Record<string, string> = {
        PHP: 'Philippine Peso',
        NGN: 'Nigerian Naira',
        ARS: 'Argentine Peso',
        EUR: 'Euro',
        USD: 'US Dollar'
      };
      const code = asset.replace('iso4217:', '');
      return currencyNames[code] || code;
    }
    return asset;
  }
}