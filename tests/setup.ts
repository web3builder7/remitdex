// Mock environment variables for testing
process.env.STELLAR_NETWORK = 'testnet';
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Add custom matchers if needed
expect.extend({
  toBeValidAddress(received: string, chainType: 'stellar' | 'evm') {
    if (chainType === 'stellar') {
      const pass = /^G[A-Z0-9]{55}$/.test(received);
      return {
        pass,
        message: () => `expected ${received} to be a valid Stellar address`
      };
    } else {
      const pass = /^0x[a-fA-F0-9]{40}$/.test(received);
      return {
        pass,
        message: () => `expected ${received} to be a valid EVM address`
      };
    }
  }
});