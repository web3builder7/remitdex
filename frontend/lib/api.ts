export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

export interface RemittanceOrder {
  id: string;
  sender: {
    address: string;
    chain: string;
  };
  recipient: {
    name: string;
    country: string;
    currency: string;
    accountDetails: any;
  };
  quote: RemittanceQuote;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  htlcId?: string;
  stellarTxHash?: string;
  anchorTxId?: string;
}

export interface Corridor {
  from: string;
  to: string;
  currencies: string[];
  methods: string[];
  estimatedTime: string;
  maxAmount: number;
}

class RemittanceAPI {
  async getQuote(params: {
    fromChain: string;
    fromToken: string;
    fromAmount: string;
    toCountry: string;
    toCurrency: string;
    deliveryMethod?: string;
  }): Promise<RemittanceQuote> {
    const response = await fetch(`${API_BASE_URL}/api/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get quote');
    }

    const data = await response.json();
    return data.quote;
  }

  async executeRemittance(
    quote: RemittanceQuote,
    senderAddress: string,
    recipientDetails: any
  ): Promise<RemittanceOrder> {
    const response = await fetch(`${API_BASE_URL}/api/remit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quote,
        senderAddress,
        recipientDetails,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to execute remittance');
    }

    const data = await response.json();
    return data.order;
  }

  async getOrderStatus(orderId: string): Promise<RemittanceOrder | null> {
    const response = await fetch(`${API_BASE_URL}/api/order/${orderId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to get order status');
    }

    const data = await response.json();
    return data.order;
  }

  async getSupportedCorridors(): Promise<Corridor[]> {
    const response = await fetch(`${API_BASE_URL}/api/corridors`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get corridors');
    }

    const data = await response.json();
    return data.corridors;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const remittanceAPI = new RemittanceAPI();