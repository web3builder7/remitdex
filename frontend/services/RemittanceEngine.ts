import { OneInchAggregator } from './OneInchAggregator';
import { StellarAnchorService } from './StellarAnchorService';
import { StellarBridge } from './StellarBridge';
import { DeliveryMethodHandler } from './delivery/DeliveryMethodHandler';
import { AnchorIntegrations } from './anchors/AnchorIntegrations';
import { SEP6Service } from './anchors/SEP6Service';
import { SEP24Service } from './anchors/SEP24Service';
import { DeliveryErrorHandler } from './delivery/DeliveryErrorHandler';
import { OrderRepository } from './database/OrderRepository';
import { MetricsCollector } from './monitoring/MetricsCollector';
import { 
  RemittanceQuote, 
  RemittanceOrder, 
  RouteStep 
} from '../interfaces/IRemittance';
import { ethers } from 'ethers';
import { getWrappedStellarUSDC, HTLC_BRIDGE_CONTRACTS } from '../config/wrapped-stellar-usdc';

export class RemittanceEngine {
  private oneInch: OneInchAggregator;
  private anchorService: StellarAnchorService;
  private stellarBridge: StellarBridge;
  private orders: Map<string, RemittanceOrder>;
  private deliveryHandler: DeliveryMethodHandler;
  private anchorIntegrations: AnchorIntegrations;
  private sep6Service: SEP6Service;
  private sep24Service: SEP24Service;
  private errorHandler: DeliveryErrorHandler;
  private orderRepository: OrderRepository;
  private metricsCollector: MetricsCollector;

  constructor(
    oneInchApiKey: string,
    stellarNetwork: 'testnet' | 'mainnet' = 'testnet'
  ) {
    this.oneInch = new OneInchAggregator(oneInchApiKey);
    this.anchorService = new StellarAnchorService(stellarNetwork);
    this.stellarBridge = new StellarBridge(stellarNetwork);
    this.orders = new Map();
    
    // Initialize new services
    this.deliveryHandler = new DeliveryMethodHandler();
    this.anchorIntegrations = new AnchorIntegrations();
    this.sep6Service = new SEP6Service();
    this.sep24Service = new SEP24Service();
    this.orderRepository = new OrderRepository();
    this.metricsCollector = new MetricsCollector();
    this.errorHandler = new DeliveryErrorHandler(this.orderRepository, this.metricsCollector);
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
    const wrappedStellarUSDC = getWrappedStellarUSDC(params.fromChain);
    if (!wrappedStellarUSDC) {
      throw new Error(`Wrapped Stellar USDC not available on ${params.fromChain}`);
    }
    
    const oneInchQuote = await this.oneInch.getQuote({
      fromChain: this.getChainId(params.fromChain),
      fromToken: params.fromToken,
      toToken: wrappedStellarUSDC.address,
      amount: params.fromAmount,
      fromAddress: '0x0000000000000000000000000000000000000000', // Zero address for quotes
      slippage: 1
    });

    // Step 3: Calculate exchange rate and fees
    const exchangeRate = await this.anchorService.getExchangeRate(
      'USD',
      params.toCurrency,
      anchor.code
    );
// 
    const usdcAmount = ethers.formatUnits(oneInchQuote.toAmount || '0', 6);
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

    // Save order to repository
    await this.orderRepository.save(order);
    this.orders.set(orderId, order);

    try {
      // Step 1: Execute 1inch swap
      order.status = 'processing';
      await this.orderRepository.updateStatus(orderId, 'processing');
      
      const wrappedStellarUSDC = getWrappedStellarUSDC(quote.fromChain);
      if (!wrappedStellarUSDC) {
        throw new Error(`Wrapped Stellar USDC not available on ${quote.fromChain}`);
      }
      
      const swapTx = await this.oneInch.buildSwapTx({
        fromChain: this.getChainId(quote.fromChain),
        fromToken: quote.fromToken,
        toToken: wrappedStellarUSDC.address,
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

      // Step 3: Determine delivery method and anchor
      const anchor = await this.anchorService.getAnchorForCorridor(
        'US',
        quote.toCountry,
        quote.toCurrency
      );

      if (!anchor) {
        throw new Error('No anchor available for this corridor');
      }

      // Step 4: Check if we should use SEP-6 or SEP-24
      const protocol = await this.sep24Service.recommendProtocol(
        anchor.code,
        quote.toCurrency
      );

      let withdrawResult: any;

      if (protocol === 'sep6') {
        // Use programmatic withdrawal (SEP-6)
        withdrawResult = await this.processSEP6Withdrawal(
          anchor.code,
          quote,
          recipientDetails,
          htlcResult.stellarAccount
        );
      } else {
        // Use interactive withdrawal (SEP-24)
        withdrawResult = await this.processSEP24Withdrawal(
          anchor.code,
          quote,
          recipientDetails,
          htlcResult.stellarAccount
        );
      }

      order.anchorTxId = withdrawResult.id;
      order.status = 'completed';
      order.completedAt = new Date();

      // Update repository
      await this.orderRepository.updateStatus(orderId, 'completed', {
        anchorTxId: withdrawResult.id,
        completedAt: order.completedAt
      });

      // Record metrics
      this.metricsCollector.recordOrder(order);

    } catch (error: any) {
      // Handle error with proper classification
      const deliveryError = await this.errorHandler.handleDeliveryError(
        orderId,
        error,
        { quote, recipientDetails }
      );

      order.status = 'failed';
      throw new Error(this.errorHandler.getUserFriendlyMessage(deliveryError));
    }

    return order;
  }

  private async processSEP6Withdrawal(
    anchorCode: string,
    quote: RemittanceQuote,
    recipientDetails: any,
    stellarAccount: string
  ): Promise<any> {
    // Get delivery method details
    const deliveryMethods = this.deliveryHandler.getAvailableDeliveryMethods(
      quote.toCountry,
      quote.toCurrency
    );

    const selectedMethod = deliveryMethods.find(
      m => m.type === recipientDetails.deliveryMethod
    );

    if (!selectedMethod) {
      throw new Error('Invalid delivery method');
    }

    // Use anchor-specific integration
    switch (anchorCode) {
      case 'CLICK_PHP':
        return await this.anchorIntegrations.clickPhilippinesIntegration({
          action: 'withdraw',
          amount: quote.toAmount,
          deliveryMethod: recipientDetails.deliveryMethod,
          recipient: recipientDetails,
          stellarAccount
        });

      case 'COWRIE_NGN':
        return await this.anchorIntegrations.cowrieNigeriaIntegration({
          action: 'withdraw',
          amount: quote.toAmount,
          deliveryMethod: recipientDetails.deliveryMethod,
          recipient: recipientDetails,
          stellarAccount
        });

      default:
        // Generic SEP-6 withdrawal
        await this.sep6Service.authenticate(anchorCode, stellarAccount);
        return await this.sep6Service.withdraw({
          anchorCode,
          asset_code: quote.toCurrency,
          amount: quote.toAmount,
          type: recipientDetails.deliveryMethod,
          account: stellarAccount,
          ...this.buildSEP6Params(recipientDetails)
        });
    }
  }

  private async processSEP24Withdrawal(
    anchorCode: string,
    quote: RemittanceQuote,
    recipientDetails: any,
    stellarAccount: string
  ): Promise<any> {
    // SEP-24 interactive flow
    const interactiveResult = await this.sep24Service.initiateWithdraw({
      anchorCode,
      asset_code: quote.toCurrency,
      amount: quote.toAmount,
      account: stellarAccount,
      sep9: this.buildSEP9Fields(recipientDetails)
    });

    // In production, would handle the interactive flow
    // For now, return the transaction ID
    return interactiveResult;
  }

  private buildSEP6Params(recipientDetails: any): any {
    const params: any = {};

    if (recipientDetails.deliveryMethod === 'bank_transfer') {
      params.bank_account = {
        account_number: recipientDetails.accountNumber,
        bank_name: recipientDetails.bankName,
        routing_number: recipientDetails.routingNumber,
        swift_code: recipientDetails.swiftCode
      };
    } else if (recipientDetails.deliveryMethod === 'gcash') {
      params.gcash = {
        phone_number: recipientDetails.phoneNumber,
        account_name: recipientDetails.accountName
      };
    } else if (recipientDetails.deliveryMethod === 'mobile_money') {
      params.mobile_money = {
        phone_number: recipientDetails.phoneNumber,
        provider: recipientDetails.provider,
        account_name: recipientDetails.accountName
      };
    }

    return params;
  }

  private buildSEP9Fields(recipientDetails: any): any {
    return {
      first_name: recipientDetails.firstName,
      last_name: recipientDetails.lastName,
      email_address: recipientDetails.email,
      mobile_number: recipientDetails.phoneNumber,
      bank_account_number: recipientDetails.accountNumber,
      bank_name: recipientDetails.bankName
    };
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