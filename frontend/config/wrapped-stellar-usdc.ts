/**
 * Wrapped Stellar USDC contract addresses on various chains
 * These are the bridge contract addresses that represent Stellar USDC on EVM chains
 */

export interface WrappedStellarToken {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

// In production, these would be the actual wrapped Stellar USDC addresses
// For now, using regular USDC addresses as placeholders
export const WRAPPED_STELLAR_USDC: Record<string, WrappedStellarToken> = {
  ethereum: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Placeholder: Regular USDC
    symbol: 'sUSDC',
    decimals: 6,
    name: 'Wrapped Stellar USDC'
  },
  bsc: {
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // Placeholder: Regular USDC
    symbol: 'sUSDC',
    decimals: 18,
    name: 'Wrapped Stellar USDC'
  },
  polygon: {
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Placeholder: Regular USDC
    symbol: 'sUSDC',
    decimals: 6,
    name: 'Wrapped Stellar USDC'
  },
  arbitrum: {
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // Placeholder: Regular USDC
    symbol: 'sUSDC',
    decimals: 6,
    name: 'Wrapped Stellar USDC'
  },
  optimism: {
    address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // Placeholder: Regular USDC
    symbol: 'sUSDC',
    decimals: 6,
    name: 'Wrapped Stellar USDC'
  },
  avalanche: {
    address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // Placeholder: Regular USDC
    symbol: 'sUSDC',
    decimals: 6,
    name: 'Wrapped Stellar USDC'
  }
};

// Stellar USDC asset details
export const STELLAR_USDC = {
  code: 'USDC',
  issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', // Centre.io issuer
  homeDomain: 'centre.io'
};

// Bridge contract addresses for each chain
export const HTLC_BRIDGE_CONTRACTS: Record<string, string> = {
  ethereum: '0xd13361Ea6Ed3A20852eD2F0faDfDDFcdA7B13D97',
  bsc: '0xd13361Ea6Ed3A20852eD2F0faDfDDFcdA7B13D97',
  polygon: '0xd13361Ea6Ed3A20852eD2F0faDfDDFcdA7B13D97',
  arbitrum: '0xd13361Ea6Ed3A20852eD2F0faDfDDFcdA7B13D97',
  optimism: '0xd13361Ea6Ed3A20852eD2F0faDfDDFcdA7B13D97',
  avalanche: '0xd13361Ea6Ed3A20852eD2F0faDfDDFcdA7B13D97'
};

/**
 * Get the wrapped Stellar USDC address for a given chain
 */
export function getWrappedStellarUSDC(chain: string): WrappedStellarToken | null {
  return WRAPPED_STELLAR_USDC[chain.toLowerCase()] || null;
}

/**
 * Check if a token address is wrapped Stellar USDC
 */
export function isWrappedStellarUSDC(chain: string, tokenAddress: string): boolean {
  const wrappedToken = getWrappedStellarUSDC(chain);
  return wrappedToken ? 
    wrappedToken.address.toLowerCase() === tokenAddress.toLowerCase() : 
    false;
}