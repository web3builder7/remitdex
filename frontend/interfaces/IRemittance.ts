export interface RemittanceQuote {
  fromChain: string;
  fromToken: string;
  fromAmount: string;
  toCountry: string;
  toCurrency: string;
  toAmount: string;
  exchangeRate: number;
  totalFees: number;
  estimatedTime: number;
  route: RouteStep[];
}

export interface RouteStep {
  type: 'swap' | 'bridge' | 'anchor';
  from: string;
  to: string;
  protocol: string;
  fees: number;
  estimatedTime: number;
}

export interface Anchor {
  code: string;
  name: string;
  supportedCurrencies: string[];
  depositMethods: string[];
  withdrawMethods: string[];
  minimumAmount: number;
  maximumAmount: number;
  kycRequired: boolean;
}

export interface RemittanceOrder {
  id: string;
  sender: {
    address: string;
    chain: string;
    email?: string;
  };
  recipient: {
    name: string;
    country: string;
    currency: string;
    accountDetails: any;
  };
  quote: RemittanceQuote;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  htlcId?: string;
  stellarTxHash?: string;
  anchorTxId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface SupportedCorridor {
  fromCountry: string;
  toCountry: string;
  currencies: string[];
  averageDeliveryTime: number;
  maxAmount: number;
  anchor: string;
}