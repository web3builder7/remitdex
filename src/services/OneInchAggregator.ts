import axios from 'axios';
import { ethers } from 'ethers';
import { getWrappedStellarUSDC } from '../config/wrapped-stellar-usdc';

interface SwapParams {
  fromChain: number;
  fromToken: string;
  toToken: string;
  amount: string;
  fromAddress: string;
  slippage: number;
}

interface SwapQuote {
  fromToken?: any;
  toToken?: any;
  toAmount?: string;
  dstAmount?: string; // 1inch uses dstAmount
  protocols?: any[];
  estimatedGas?: string;
  gas?: string;
}

export class OneInchAggregator {
  private apiUrl = 'https://api.1inch.dev/swap/v6.0';
  private apiKey: string;
  private supportedChains = {
    ethereum: 1,
    bsc: 56,
    polygon: 137,
    arbitrum: 42161,
    optimism: 10,
    avalanche: 43114
  };
  private retryCount = 3;
  private retryDelay = 1000;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getQuote(params: SwapParams): Promise<SwapQuote> {
    let lastError: any;
    
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        // Validate inputs
        if (!this.isValidAddress(params.fromToken) || !this.isValidAddress(params.toToken)) {
          throw new Error('Invalid token address');
        }
        
        const response = await axios.get(
          `${this.apiUrl}/${params.fromChain}/quote`,
          {
            params: {
              src: params.fromToken,
              dst: params.toToken,
              amount: params.amount,
              from: params.fromAddress,
              slippage: params.slippage
            },
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            },
            timeout: 30000 // 30 second timeout
          }
        );

        // Normalize response to match our interface
        const data = response.data;
        return {
          ...data,
          toAmount: data.dstAmount || data.toAmount,
          protocols: data.protocols || [],
          estimatedGas: data.gas || data.estimatedGas || '0'
        };
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on client errors
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          throw this.handleApiError(error);
        }
        
        // Retry on network or server errors
        if (attempt < this.retryCount - 1) {
          await this.delay(this.retryDelay * Math.pow(2, attempt)); // Exponential backoff
          continue;
        }
      }
    }
    
    throw this.handleApiError(lastError);
  }

  async buildSwapTx(params: SwapParams): Promise<any> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/${params.fromChain}/swap`,
        {
          params: {
            src: params.fromToken,
            dst: params.toToken,
            amount: params.amount,
            from: params.fromAddress,
            slippage: params.slippage,
            disableEstimate: false
          },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.tx;
    } catch (error) {
      console.error('1inch swap build error:', error);
      throw new Error('Failed to build swap transaction');
    }
  }

  async findBestStablecoinRoute(
    fromChain: string,
    fromToken: string,
    amount: string,
    userAddress: string
  ): Promise<{chain: string, quote: SwapQuote}> {
    // Get wrapped Stellar USDC address for the source chain
    const wrappedStellarUSDC = getWrappedStellarUSDC(fromChain);
    if (!wrappedStellarUSDC) {
      throw new Error(`Wrapped Stellar USDC not available on ${fromChain}`);
    }
    
    const quotes = [];

    // Get quotes from the source chain to wrapped Stellar USDC
    const chainId = this.supportedChains[fromChain as keyof typeof this.supportedChains];
    if (!chainId) {
      throw new Error(`Unsupported chain: ${fromChain}`);
    }

    try {
      const quote = await this.getQuote({
        fromChain: chainId,
        fromToken,
        toToken: wrappedStellarUSDC.address,
        amount,
        fromAddress: userAddress,
        slippage: 1
      });
      quotes.push({ chain: fromChain, quote });
    } catch (error) {
      console.log(`Failed to get quote on ${fromChain}:`, error);
    }

    // In production, we could also check alternative routes through other chains
    // For now, just use direct route
    if (quotes.length === 0) {
      throw new Error('No routes available');
    }
    
    return quotes[0];
  }

  getSupportedTokens(chain: string): string[] {
    // Return common stablecoins for each chain
    const stablecoins: Record<string, string[]> = {
      ethereum: [
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0x6B175474E89094C44Da98b954EedeAC495271d0F'  // DAI
      ],
      bsc: [
        '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
        '0x55d398326f99059fF775485246999027B3197955', // USDT
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'  // BUSD
      ],
      polygon: [
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
        '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'  // DAI
      ]
    };

    return stablecoins[chain] || [];
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleApiError(error: any): Error {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.description || error.response.data?.message || 'Unknown error';
      
      switch (status) {
        case 401:
          return new Error('Invalid 1inch API key. Please check your configuration.');
        case 429:
          return new Error('Rate limit exceeded. Please try again later.');
        case 400:
          return new Error(`Bad request: ${message}`);
        case 404:
          return new Error('Token pair not found or route not available');
        default:
          return new Error(`1inch API error (${status}): ${message}`);
      }
    }
    
    if (error.code === 'ECONNABORTED') {
      return new Error('Request timeout - 1inch API took too long to respond');
    }
    
    return new Error(`Network error: ${error.message}`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check Ethereum mainnet tokens endpoint
      const response = await axios.get(
        `${this.apiUrl}/1/tokens`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 10000
        }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}