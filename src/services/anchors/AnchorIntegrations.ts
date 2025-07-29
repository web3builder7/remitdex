import axios from 'axios';
import { SEP6Service } from './SEP6Service';
import { SEP24Service } from './SEP24Service';
import { DeliveryMethodHandler } from '../delivery/DeliveryMethodHandler';

// Production-ready integrations for specific anchors

export interface AnchorConfig {
  code: string;
  name: string;
  domain: string;
  supportedAssets: string[];
  supportedCountries: string[];
  deliveryMethods: string[];
  apiEndpoint: string;
  testEndpoint?: string;
  documentation?: string;
  features: {
    sep6: boolean;
    sep24: boolean;
    sep31?: boolean; // Cross-border payments
    webhooks?: boolean;
    rateCallbacks?: boolean;
  };
}

export class AnchorIntegrations {
  private anchors: Map<string, AnchorConfig>;
  private sep6Service: SEP6Service;
  private sep24Service: SEP24Service;
  private deliveryHandler: DeliveryMethodHandler;

  constructor() {
    this.anchors = new Map();
    this.sep6Service = new SEP6Service();
    this.sep24Service = new SEP24Service();
    this.deliveryHandler = new DeliveryMethodHandler();
    this.initializeAnchors();
  }

  private initializeAnchors() {
    // Click - Philippines
    this.anchors.set('CLICK_PHP', {
      code: 'CLICK_PHP',
      name: 'Click by Coins.ph',
      domain: 'clickpeso.com',
      supportedAssets: ['PHP', 'USDC'],
      supportedCountries: ['PH'],
      deliveryMethods: ['gcash', 'paymaya', 'bank_transfer', 'cash_pickup'],
      apiEndpoint: 'https://api.clickpeso.com',
      testEndpoint: 'https://sandbox.clickpeso.com',
      documentation: 'https://docs.clickpeso.com',
      features: {
        sep6: true,
        sep24: true,
        sep31: true,
        webhooks: true,
        rateCallbacks: true
      }
    });

    // Cowrie - Nigeria
    this.anchors.set('COWRIE_NGN', {
      code: 'COWRIE_NGN',
      name: 'Cowrie Exchange',
      domain: 'cowrie.exchange',
      supportedAssets: ['NGN', 'USDC'],
      supportedCountries: ['NG'],
      deliveryMethods: ['bank_transfer', 'mobile_money'],
      apiEndpoint: 'https://api.cowrie.exchange',
      testEndpoint: 'https://sandbox.cowrie.exchange',
      features: {
        sep6: true,
        sep24: true,
        webhooks: true,
        rateCallbacks: true
      }
    });

    // Vibrant - Argentina/Latin America
    this.anchors.set('VIBRANT_USD', {
      code: 'VIBRANT_USD',
      name: 'Vibrant',
      domain: 'vibrant.stellar.org',
      supportedAssets: ['ARS', 'USD', 'USDC'],
      supportedCountries: ['AR', 'MX', 'CO'],
      deliveryMethods: ['bank_transfer', 'mobile_wallet'],
      apiEndpoint: 'https://vibrant.stellar.org',
      features: {
        sep6: false, // Vibrant primarily uses SEP-24
        sep24: true,
        webhooks: true
      }
    });

    // Settle Network - Europe
    this.anchors.set('SETTLE_EUR', {
      code: 'SETTLE_EUR',
      name: 'Settle Network',
      domain: 'settle.network',
      supportedAssets: ['EUR', 'USDC'],
      supportedCountries: ['EU', 'GB'],
      deliveryMethods: ['bank_transfer'],
      apiEndpoint: 'https://api.settle.network',
      features: {
        sep6: true,
        sep24: true,
        sep31: true,
        webhooks: true,
        rateCallbacks: true
      }
    });
  }

  // Get anchor configuration
  getAnchorConfig(anchorCode: string): AnchorConfig | null {
    return this.anchors.get(anchorCode) || null;
  }

  // Get anchors for a specific country
  getAnchorsForCountry(countryCode: string): AnchorConfig[] {
    return Array.from(this.anchors.values()).filter(
      anchor => anchor.supportedCountries.includes(countryCode)
    );
  }

  // Click (Philippines) specific integration
  async clickPhilippinesIntegration(params: {
    action: 'withdraw';
    amount: string;
    deliveryMethod: 'gcash' | 'paymaya' | 'bank_transfer';
    recipient: any;
    stellarAccount: string;
  }) {
    const anchor = this.anchors.get('CLICK_PHP')!;
    
    // Authenticate
    await this.sep6Service.authenticate('CLICK_PHP', params.stellarAccount);

    // Click-specific field mapping
    const clickParams: any = {
      anchorCode: 'CLICK_PHP',
      asset_code: 'PHP',
      amount: params.amount,
      type: params.deliveryMethod,
      account: params.stellarAccount
    };

    // Map delivery method specifics for Click
    switch (params.deliveryMethod) {
      case 'gcash':
        clickParams.dest = params.recipient.phone_number;
        clickParams.dest_extra = JSON.stringify({
          name: params.recipient.account_name,
          provider: 'GCASH'
        });
        break;

      case 'paymaya':
        clickParams.dest = params.recipient.phone_number;
        clickParams.dest_extra = JSON.stringify({
          name: params.recipient.account_name,
          provider: 'PAYMAYA'
        });
        break;

      case 'bank_transfer':
        // Click supports major Philippine banks
        const bankCodes: Record<string, string> = {
          'BDO': 'BDO_UNIBANK',
          'BPI': 'BPI',
          'Metrobank': 'MBTC',
          'UnionBank': 'UBP',
          'Security Bank': 'SECB',
          'PNB': 'PNB',
          'Landbank': 'LBP'
        };

        clickParams.dest = params.recipient.account_number;
        clickParams.dest_extra = JSON.stringify({
          bank_code: bankCodes[params.recipient.bank_name] || params.recipient.bank_name,
          account_name: params.recipient.account_name,
          bank_branch: params.recipient.bank_branch
        });
        break;
    }

    // Add Click-specific headers/params
    clickParams.lang = 'en'; // or 'tl' for Tagalog
    clickParams.on_change_callback = `https://api.remitdex.com/callbacks/click/${params.stellarAccount}`;

    return await this.sep6Service.withdraw(clickParams);
  }

  // Cowrie (Nigeria) specific integration
  async cowrieNigeriaIntegration(params: {
    action: 'withdraw';
    amount: string;
    deliveryMethod: 'bank_transfer' | 'mobile_money';
    recipient: any;
    stellarAccount: string;
  }) {
    const anchor = this.anchors.get('COWRIE_NGN')!;
    
    // Cowrie requires additional KYC fields
    const cowrieParams: any = {
      anchorCode: 'COWRIE_NGN',
      asset_code: 'NGN',
      amount: params.amount,
      type: params.deliveryMethod,
      account: params.stellarAccount
    };

    // Cowrie-specific field mapping
    if (params.deliveryMethod === 'bank_transfer') {
      // Cowrie uses NUBAN validation
      cowrieParams.dest = params.recipient.account_number;
      cowrieParams.dest_extra = JSON.stringify({
        bank_code: this.getNigerianBankCode(params.recipient.bank_name),
        account_name: params.recipient.account_name,
        bvn: params.recipient.bvn // Bank Verification Number (optional but speeds up processing)
      });
    } else if (params.deliveryMethod === 'mobile_money') {
      cowrieParams.dest = params.recipient.phone_number;
      cowrieParams.dest_extra = JSON.stringify({
        provider: params.recipient.provider,
        account_name: params.recipient.account_name
      });
    }

    // Cowrie supports Nigerian Naira locale
    cowrieParams.country_code = 'NG';
    
    return await this.sep6Service.withdraw(cowrieParams);
  }

  // Vibrant (Argentina) specific integration
  async vibrantArgentinaIntegration(params: {
    action: 'withdraw';
    amount: string;
    recipient: any;
    stellarAccount: string;
  }) {
    // Vibrant primarily uses SEP-24 (interactive flow)
    const vibrantParams = {
      anchorCode: 'VIBRANT_USD',
      asset_code: 'ARS',
      amount: params.amount,
      account: params.stellarAccount,
      lang: 'es', // Spanish for Argentina
      country_code: 'AR',
      // Pre-fill SEP-9 fields
      sep9: {
        first_name: params.recipient.first_name,
        last_name: params.recipient.last_name,
        email_address: params.recipient.email,
        bank_account_number: params.recipient.cbu_cvu,
        tax_id: params.recipient.cuit_cuil
      }
    };

    // Vibrant uses interactive flow for compliance
    const interactiveResponse = await this.sep24Service.initiateWithdraw(vibrantParams);
    
    return {
      type: 'interactive',
      url: interactiveResponse.url,
      id: interactiveResponse.id,
      message: 'Please complete KYC verification in the popup window'
    };
  }

  // Helper: Get Nigerian bank codes
  private getNigerianBankCode(bankName: string): string {
    const bankCodes: Record<string, string> = {
      'First Bank': '011',
      'GTBank': '058',
      'Access Bank': '044',
      'Zenith Bank': '057',
      'UBA': '033',
      'Sterling Bank': '232',
      'Fidelity Bank': '070',
      'Union Bank': '032',
      'Stanbic IBTC': '221',
      'Ecobank': '050'
    };
    return bankCodes[bankName] || '000';
  }

  // Get real-time rates from anchor
  async getAnchorRates(
    anchorCode: string,
    sellAsset: string,
    buyAsset: string,
    amount: string
  ): Promise<{
    rate: number;
    fee: number;
    total: string;
    expires?: Date;
  }> {
    const anchor = this.anchors.get(anchorCode);
    if (!anchor) throw new Error('Unknown anchor');

    // Use callback service for real-time rates
    const callbackService = new (await import('./AnchorCallbackService')).AnchorCallbackService();
    const rateResponse = await callbackService.getAnchorRate(
      anchorCode,
      sellAsset,
      buyAsset,
      amount,
      'sell'
    );

    if (!rateResponse) {
      // Fallback to static rates
      return this.getStaticRate(anchorCode, sellAsset, buyAsset, amount);
    }

    return {
      rate: parseFloat(rateResponse.rate.price),
      fee: parseFloat(rateResponse.rate.fee.total),
      total: rateResponse.rate.buy_amount,
      expires: rateResponse.rate.expire_at ? new Date(rateResponse.rate.expire_at) : undefined
    };
  }

  // Fallback static rates
  private getStaticRate(
    anchorCode: string,
    sellAsset: string,
    buyAsset: string,
    amount: string
  ): {
    rate: number;
    fee: number;
    total: string;
  } {
    const rates: Record<string, number> = {
      'CLICK_PHP': 56.50,
      'COWRIE_NGN': 1520.00,
      'VIBRANT_USD': 850.00, // ARS per USD
      'SETTLE_EUR': 0.92
    };

    const rate = rates[anchorCode] || 1;
    const fee = parseFloat(amount) * 0.005; // 0.5% fee
    const total = (parseFloat(amount) - fee) * rate;

    return {
      rate,
      fee,
      total: total.toFixed(2)
    };
  }

  // Check anchor health/availability
  async checkAnchorHealth(anchorCode: string): Promise<{
    available: boolean;
    sep6: boolean;
    sep24: boolean;
    message?: string;
  }> {
    const anchor = this.anchors.get(anchorCode);
    if (!anchor) {
      return { available: false, sep6: false, sep24: false, message: 'Unknown anchor' };
    }

    try {
      // Try to fetch .well-known/stellar.toml
      const tomlResponse = await axios.get(
        `https://${anchor.domain}/.well-known/stellar.toml`,
        { timeout: 5000 }
      );

      // Check SEP endpoints
      const sep6Available = anchor.features.sep6 && tomlResponse.data.includes('TRANSFER_SERVER');
      const sep24Available = anchor.features.sep24 && tomlResponse.data.includes('TRANSFER_SERVER_SEP0024');

      return {
        available: true,
        sep6: sep6Available,
        sep24: sep24Available
      };
    } catch (error) {
      return {
        available: false,
        sep6: false,
        sep24: false,
        message: 'Anchor temporarily unavailable'
      };
    }
  }
}