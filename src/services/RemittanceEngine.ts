import { OneInchAggregator } from './OneInchAggregator';
import { StellarAnchorService } from './StellarAnchorService';
import { StellarBridge } from './StellarBridge';
import { 
  RemittanceQuote, 
  RemittanceOrder, 
  RouteStep 
} from '../interfaces/IRemittance';
import { ethers } from 'ethers';

export class RemittanceEngine {
  private oneInch: OneInchAggregator;
  private anchorService: StellarAnchorService;
  private stellarBridge: StellarBridge;
  private orders: Map<string, RemittanceOrder>;

  constructor(
    oneInchApiKey: string,
    stellarNetwork: 'testnet' | 'mainnet' = 'testnet'
  ) {
    this.oneInch = new OneInchAggregator(oneInchApiKey);
    this.anchorService = new StellarAnchorService(stellarNetwork);
    this.stellarBridge = new StellarBridge(stellarNetwork);
    this.orders = new Map();
  }

  async getQuote(params: {
    fromChain: string;
    fromToken: string;
    fromAmount: string;
    toCountry: string;
    toCurrency: string;
    deliveryMethod?: string;
  }): Promise<RemittanceQuote> {
    // Step 1: Find suitable anchor
    const anchor = await this.anchorService.getAnchorForCorridor(
      'US', // Assuming sender is in US for demo
      params.toCountry,
      params.toCurrency
    );

    if (!anchor) {
      throw new Error(`No anchor available for ${params.toCountry} ${params.toCurrency}`);
    }

    // Step 2: Get 1inch quote to Stellar USDC
    const stellarUSDCAddress = '0x...'; // Wrapped Stellar USDC on source chain
    const oneInchQuote = await this.oneInch.getQuote({
      fromChain: this.getChainId(params.fromChain),
      fromToken: params.fromToken,
      toToken: stellarUSDCAddress,
      amount: params.fromAmount,
      fromAddress: '0x...', // Temp address for quote
      slippage: 1
    });

    // Step 3: Calculate exchange rate and fees
    const exchangeRate = await this.anchorService.getExchangeRate(
      'USD',
      params.toCurrency,
      anchor.code
    );

    const usdcAmount = ethers.formatUnits(oneInchQuote.toAmount, 6);
    const localAmount = parseFloat(usdcAmount) * exchangeRate;

    // Step 4: Build route
    const route: RouteStep[] = [
      {
        type: 'swap',
        from: `${params.fromChain}:${params.fromToken}`,
        to: `${params.fromChain}:USDC`,
        protocol: '1inch',
        fees: 0.003, // 0.3% 1inch fee
        estimatedTime: 1
      },
      {
        type: 'bridge',
        from: `${params.fromChain}:USDC`,
        to: 'stellar:USDC',
        protocol: 'HTLC',
        fees: 0.001, // 0.1% bridge fee
        estimatedTime: 2
      },
      {
        type: 'anchor',
        from: 'stellar:USDC',
        to: `bank:${params.toCurrency}`,
        protocol: anchor.code,
        fees: 0.005, // 0.5% anchor fee
        estimatedTime: await this.anchorService.estimateDeliveryTime(
          anchor.code,
          params.deliveryMethod || 'bank_transfer'
        )
      }
    ];

    const totalFees = route.reduce((sum, step) => sum + step.fees, 0);
    const totalTime = route.reduce((sum, step) => sum + step.estimatedTime, 0);

    return {
      fromChain: params.fromChain,
      fromToken: params.fromToken,
      fromAmount: params.fromAmount,
      toCountry: params.toCountry,
      toCurrency: params.toCurrency,
      toAmount: (localAmount * (1 - totalFees)).toFixed(2),
      exchangeRate,
      totalFees: totalFees * 100, // Convert to percentage
      estimatedTime: totalTime,
      route
    };
  }

  async executeRemittance(
    quote: RemittanceQuote,
    senderAddress: string,
    recipientDetails: any
  ): Promise<RemittanceOrder> {
    const orderId = `RMT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const order: RemittanceOrder = {
      id: orderId,
      sender: {
        address: senderAddress,
        chain: quote.fromChain
      },
      recipient: {
        name: recipientDetails.name,
        country: quote.toCountry,
        currency: quote.toCurrency,
        accountDetails: recipientDetails
      },
      quote,
      status: 'pending',
      createdAt: new Date()
    };

    this.orders.set(orderId, order);

    try {
      // Step 1: Execute 1inch swap
      order.status = 'processing';
      const swapTx = await this.oneInch.buildSwapTx({
        fromChain: this.getChainId(quote.fromChain),
        fromToken: quote.fromToken,
        toToken: '0x...', // Stellar USDC wrapper
        amount: quote.fromAmount,
        fromAddress: senderAddress,
        slippage: 1
      });

      // Step 2: Bridge to Stellar via HTLC
      const htlcResult = await this.stellarBridge.bridgeToStellar(
        senderAddress,
        quote.fromAmount,
        quote.fromChain
      );
      order.htlcId = htlcResult.htlcId;
      order.stellarTxHash = htlcResult.stellarTxHash;

      // Step 3: Initiate anchor withdrawal
      const anchor = await this.anchorService.getAnchorForCorridor(
        'US',
        quote.toCountry,
        quote.toCurrency
      );

      if (anchor) {
        const withdrawId = await this.anchorService.createWithdrawRequest(
          anchor.code,
          htlcResult.stellarAccount,
          quote.toAmount,
          quote.toCurrency,
          recipientDetails
        );
        order.anchorTxId = withdrawId;
      }

      order.status = 'completed';
      order.completedAt = new Date();

    } catch (error) {
      order.status = 'failed';
      console.error('Remittance failed:', error);
      throw error;
    }

    return order;
  }

  async getOrderStatus(orderId: string): Promise<RemittanceOrder | null> {
    return this.orders.get(orderId) || null;
  }

  private getChainId(chainName: string): number {
    const chainIds: Record<string, number> = {
      ethereum: 1,
      bsc: 56,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      avalanche: 43114
    };
    return chainIds[chainName] || 1;
  }

  async getSupportedCorridors(): Promise<any[]> {
    return [
      {
        from: 'US',
        to: 'Philippines',
        currencies: ['PHP'],
        methods: ['bank_transfer', 'gcash', 'paymaya'],
        estimatedTime: '1-60 minutes',
        maxAmount: 10000
      },
      {
        from: 'US',
        to: 'Nigeria',
        currencies: ['NGN'],
        methods: ['bank_transfer', 'mobile_money'],
        estimatedTime: '5-120 minutes',
        maxAmount: 10000
      },
      {
        from: 'US',
        to: 'Argentina',
        currencies: ['ARS'],
        methods: ['bank_transfer', 'mobile_wallet'],
        estimatedTime: '5 minutes - 24 hours',
        maxAmount: 10000
      },
      {
        from: 'Europe',
        to: 'Philippines',
        currencies: ['PHP'],
        methods: ['bank_transfer', 'gcash'],
        estimatedTime: '1-60 minutes',
        maxAmount: 50000
      }
    ];
  }
}