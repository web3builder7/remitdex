import { RemittanceEngine } from '../src/services/RemittanceEngine';
import { OneInchAggregator } from '../src/services/OneInchAggregator';
import { StellarAnchorService } from '../src/services/StellarAnchorService';
import { HTLCBridge } from '../src/contracts/HTLCBridge';

describe('RemittanceEngine', () => {
  let remittanceEngine: RemittanceEngine;

  beforeEach(() => {
    remittanceEngine = new RemittanceEngine('test-api-key', 'testnet');
  });

  describe('getQuote', () => {
    it('should return valid quote for Philippines corridor', async () => {
      const quote = await remittanceEngine.getQuote({
        fromChain: 'ethereum',
        fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        fromAmount: '100',
        toCountry: 'Philippines',
        toCurrency: 'PHP',
        deliveryMethod: 'gcash'
      });

      expect(quote).toBeDefined();
      expect(quote.toCountry).toBe('Philippines');
      expect(quote.toCurrency).toBe('PHP');
      expect(parseFloat(quote.toAmount)).toBeGreaterThan(0);
      expect(quote.totalFees).toBeLessThan(1); // Less than 1%
      expect(quote.route).toHaveLength(3);
    });

    it('should handle unsupported corridors', async () => {
      await expect(
        remittanceEngine.getQuote({
          fromChain: 'ethereum',
          fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          fromAmount: '100',
          toCountry: 'Mars',
          toCurrency: 'MARS',
          deliveryMethod: 'teleport'
        })
      ).rejects.toThrow('No anchor available');
    });
  });

  describe('getSupportedCorridors', () => {
    it('should return list of supported corridors', async () => {
      const corridors = await remittanceEngine.getSupportedCorridors();
      
      expect(corridors).toBeInstanceOf(Array);
      expect(corridors.length).toBeGreaterThan(0);
      expect(corridors[0]).toHaveProperty('from');
      expect(corridors[0]).toHaveProperty('to');
      expect(corridors[0]).toHaveProperty('currencies');
      expect(corridors[0]).toHaveProperty('methods');
    });
  });
});

describe('OneInchAggregator', () => {
  let aggregator: OneInchAggregator;

  beforeEach(() => {
    aggregator = new OneInchAggregator('test-api-key');
  });

  describe('getSupportedTokens', () => {
    it('should return stablecoins for each chain', () => {
      const ethereumTokens = aggregator.getSupportedTokens('ethereum');
      expect(ethereumTokens).toContain('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'); // USDC
      
      const bscTokens = aggregator.getSupportedTokens('bsc');
      expect(bscTokens).toContain('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'); // BUSD
    });
  });
});

describe('StellarAnchorService', () => {
  let anchorService: StellarAnchorService;

  beforeEach(() => {
    anchorService = new StellarAnchorService('testnet');
  });

  describe('getAnchorForCorridor', () => {
    it('should find correct anchor for US to Philippines', async () => {
      const anchor = await anchorService.getAnchorForCorridor('US', 'Philippines', 'PHP');
      
      expect(anchor).toBeDefined();
      expect(anchor?.code).toBe('CLICK_PHP');
      expect(anchor?.supportedCurrencies).toContain('PHP');
    });

    it('should find correct anchor for US to Nigeria', async () => {
      const anchor = await anchorService.getAnchorForCorridor('US', 'Nigeria', 'NGN');
      
      expect(anchor).toBeDefined();
      expect(anchor?.code).toBe('COWRIE_NGN');
      expect(anchor?.supportedCurrencies).toContain('NGN');
    });
  });

  describe('getExchangeRate', () => {
    it('should return realistic exchange rates', async () => {
      const phpRate = await anchorService.getExchangeRate('USD', 'PHP');
      expect(phpRate).toBeGreaterThan(50);
      expect(phpRate).toBeLessThan(60);
      
      const ngnRate = await anchorService.getExchangeRate('USD', 'NGN');
      expect(ngnRate).toBeGreaterThan(1000);
      expect(ngnRate).toBeLessThan(2000);
    });
  });

  describe('estimateDeliveryTime', () => {
    it('should return fast delivery for mobile wallets', async () => {
      const gcashTime = await anchorService.estimateDeliveryTime('CLICK_PHP', 'gcash');
      expect(gcashTime).toBeLessThanOrEqual(5);
      
      const bankTime = await anchorService.estimateDeliveryTime('CLICK_PHP', 'bank_transfer');
      expect(bankTime).toBeGreaterThan(gcashTime);
    });
  });
});

describe('HTLCBridge', () => {
  let htlcBridge: HTLCBridge;

  beforeEach(() => {
    htlcBridge = new HTLCBridge();
  });

  describe('createCrossChainSwap', () => {
    it('should generate valid HTLC parameters', async () => {
      const result = await htlcBridge.createCrossChainSwap({
        sourceChain: 'ethereum',
        sourceToken: 'USDC',
        targetChain: 'stellar',
        targetToken: 'USDC',
        amount: '100',
        senderAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
        recipientAddress: 'GDQJL3RJKP3G5V2R3CIXTZBLNKNS5PV4IKVCMQVROZIXJDJ6NE2K4QTR'
      });

      expect(result.htlcId).toMatch(/^HTLC-\d+-/);
      expect(result.secret).toHaveLength(66); // 0x + 64 hex chars
      expect(result.hashlock).toHaveLength(66);
      expect(result.timelock).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('getHTLCStatus', () => {
    it('should return HTLC status', async () => {
      const status = await htlcBridge.getHTLCStatus('ethereum', 'test-htlc-id');
      expect(['active', 'claimed', 'refunded', 'expired']).toContain(status);
    });
  });
});