import axios from 'axios';
import * as StellarSdk from '@stellar/stellar-sdk';
import jwt from 'jsonwebtoken';

// SEP-6: Programmatic deposit and withdrawal API
// Used for direct API integration with anchors

export interface SEP6Info {
  deposit: {
    [assetCode: string]: {
      enabled: boolean;
      min_amount?: number;
      max_amount?: number;
      fee_fixed?: number;
      fee_percent?: number;
      fields?: SEP6Field[];
    };
  };
  withdraw: {
    [assetCode: string]: {
      enabled: boolean;
      min_amount?: number;
      max_amount?: number;
      fee_fixed?: number;
      fee_percent?: number;
      types?: {
        [type: string]: {
          fields?: SEP6Field[];
        };
      };
    };
  };
}

export interface SEP6Field {
  name: string;
  description: string;
  optional?: boolean;
  choices?: string[];
}

export interface SEP6DepositResponse {
  how: string;
  id: string;
  eta?: number;
  min_amount?: number;
  max_amount?: number;
  fee_fixed?: number;
  fee_percent?: number;
  extra_info?: {
    message?: string;
  };
}

export interface SEP6WithdrawResponse {
  account_id: string;
  memo_type?: string;
  memo?: string;
  id: string;
  eta?: number;
  min_amount?: number;
  max_amount?: number;
  fee_fixed?: number;
  fee_percent?: number;
  extra_info?: {
    message?: string;
  };
}

export class SEP6Service {
  private anchorEndpoints: Map<string, string>;
  private authTokens: Map<string, string>;

  constructor() {
    // Production anchor endpoints
    this.anchorEndpoints = new Map([
      ['CLICK_PHP', 'https://api.clickpeso.com'],
      ['COWRIE_NGN', 'https://api.cowrie.exchange'],
      ['VIBRANT_USD', 'https://vibrant.stellar.org'],
      ['SETTLE_EUR', 'https://api.settle.network']
    ]);
    this.authTokens = new Map();
  }

  // Get SEP-10 authentication token
  async authenticate(anchorCode: string, stellarAccount: string): Promise<string> {
    const endpoint = this.anchorEndpoints.get(anchorCode);
    if (!endpoint) throw new Error(`Unknown anchor: ${anchorCode}`);

    try {
      // Step 1: Get challenge
      const challengeResponse = await axios.get(
        `${endpoint}/auth`,
        {
          params: { account: stellarAccount }
        }
      );

      const { transaction, network_passphrase } = challengeResponse.data;

      // Step 2: Sign challenge
      // In production, use actual Stellar keypair
      const signedTransaction = transaction; // Would sign with private key

      // Step 3: Submit signed challenge
      const tokenResponse = await axios.post(
        `${endpoint}/auth`,
        { transaction: signedTransaction }
      );

      const token = tokenResponse.data.token;
      this.authTokens.set(anchorCode, token);
      return token;
    } catch (error) {
      console.error(`SEP-10 auth failed for ${anchorCode}:`, error);
      throw new Error('Authentication failed');
    }
  }

  // Get anchor capabilities
  async getInfo(anchorCode: string): Promise<SEP6Info> {
    const endpoint = this.anchorEndpoints.get(anchorCode);
    if (!endpoint) throw new Error(`Unknown anchor: ${anchorCode}`);

    const response = await axios.get(`${endpoint}/sep6/info`);
    return response.data;
  }

  // Initiate withdrawal (send money to recipient)
  async withdraw(params: {
    anchorCode: string;
    asset_code: string;
    amount: string;
    type: string; // bank_account, mobile_money, gcash, etc.
    dest?: string; // Recipient account details
    dest_extra?: string; // Additional recipient info
    account: string; // Stellar account
    memo?: string;
    lang?: string;
    on_change_callback?: string;
    country_code?: string;
    // Recipient details based on delivery method
    bank_account?: {
      account_number: string;
      routing_number?: string;
      bank_name?: string;
      bank_branch?: string;
      swift_code?: string;
    };
    mobile_money?: {
      phone_number: string;
      provider: string;
      account_name?: string;
    };
    gcash?: {
      phone_number: string;
      account_name: string;
    };
    paymaya?: {
      phone_number: string;
      account_name: string;
    };
  }): Promise<SEP6WithdrawResponse> {
    const endpoint = this.anchorEndpoints.get(params.anchorCode);
    if (!endpoint) throw new Error(`Unknown anchor: ${params.anchorCode}`);

    const token = this.authTokens.get(params.anchorCode);
    if (!token) throw new Error('Not authenticated');

    // Build request based on delivery method
    const requestData: any = {
      asset_code: params.asset_code,
      amount: params.amount,
      type: params.type,
      account: params.account
    };

    // Add delivery method specific fields
    switch (params.type) {
      case 'bank_account':
        if (!params.bank_account) throw new Error('Bank account details required');
        requestData.dest = params.bank_account.account_number;
        requestData.dest_extra = JSON.stringify({
          routing_number: params.bank_account.routing_number,
          bank_name: params.bank_account.bank_name,
          bank_branch: params.bank_account.bank_branch,
          swift_code: params.bank_account.swift_code
        });
        break;

      case 'mobile_money':
        if (!params.mobile_money) throw new Error('Mobile money details required');
        requestData.dest = params.mobile_money.phone_number;
        requestData.dest_extra = JSON.stringify({
          provider: params.mobile_money.provider,
          account_name: params.mobile_money.account_name
        });
        break;

      case 'gcash':
        if (!params.gcash) throw new Error('GCash details required');
        requestData.dest = params.gcash.phone_number;
        requestData.dest_extra = JSON.stringify({
          account_name: params.gcash.account_name,
          provider: 'gcash'
        });
        break;

      case 'paymaya':
        if (!params.paymaya) throw new Error('PayMaya details required');
        requestData.dest = params.paymaya.phone_number;
        requestData.dest_extra = JSON.stringify({
          account_name: params.paymaya.account_name,
          provider: 'paymaya'
        });
        break;
    }

    if (params.memo) requestData.memo = params.memo;
    if (params.lang) requestData.lang = params.lang;
    if (params.on_change_callback) requestData.on_change_callback = params.on_change_callback;
    if (params.country_code) requestData.country_code = params.country_code;

    try {
      const response = await axios.post(
        `${endpoint}/sep6/withdraw`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('SEP-6 withdraw error:', error.response?.data || error);
      throw new Error(`Withdrawal failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // Get withdrawal status
  async getWithdrawStatus(
    anchorCode: string,
    id: string
  ): Promise<{
    transaction: {
      id: string;
      kind: string;
      status: string;
      status_eta?: number;
      amount_in: string;
      amount_out: string;
      amount_fee: string;
      started_at: string;
      completed_at?: string;
      stellar_transaction_id?: string;
      external_transaction_id?: string;
      message?: string;
    };
  }> {
    const endpoint = this.anchorEndpoints.get(anchorCode);
    if (!endpoint) throw new Error(`Unknown anchor: ${anchorCode}`);

    const token = this.authTokens.get(anchorCode);
    if (!token) throw new Error('Not authenticated');

    const response = await axios.get(
      `${endpoint}/sep6/transaction`,
      {
        params: { id },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return response.data;
  }

  // Get all transactions
  async getTransactions(
    anchorCode: string,
    params?: {
      asset_code?: string;
      account?: string;
      no_older_than?: string;
      limit?: number;
      kind?: 'deposit' | 'withdrawal';
      paging_id?: string;
    }
  ): Promise<{
    transactions: Array<{
      id: string;
      kind: string;
      status: string;
      amount_in: string;
      amount_out: string;
      amount_fee: string;
      started_at: string;
      completed_at?: string;
    }>;
  }> {
    const endpoint = this.anchorEndpoints.get(anchorCode);
    if (!endpoint) throw new Error(`Unknown anchor: ${anchorCode}`);

    const token = this.authTokens.get(anchorCode);
    if (!token) throw new Error('Not authenticated');

    const response = await axios.get(
      `${endpoint}/sep6/transactions`,
      {
        params,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return response.data;
  }

  // Helper to calculate total fees
  calculateFees(
    amount: number,
    feeFixed?: number,
    feePercent?: number
  ): {
    fixed: number;
    percentage: number;
    total: number;
  } {
    const fixed = feeFixed || 0;
    const percentage = feePercent ? (amount * feePercent / 100) : 0;
    const total = fixed + percentage;

    return { fixed, percentage, total };
  }

  // Validate recipient details based on delivery method
  validateRecipientDetails(
    type: string,
    details: any
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (type) {
      case 'bank_account':
        if (!details.account_number) errors.push('Account number required');
        if (!details.bank_name) errors.push('Bank name required');
        // Add more validations based on country
        break;

      case 'gcash':
      case 'paymaya':
        if (!details.phone_number) errors.push('Phone number required');
        if (!details.account_name) errors.push('Account name required');
        // Validate Philippine phone number format
        if (details.phone_number && !details.phone_number.match(/^\+639\d{9}$/)) {
          errors.push('Invalid Philippine phone number format');
        }
        break;

      case 'mobile_money':
        if (!details.phone_number) errors.push('Phone number required');
        if (!details.provider) errors.push('Provider required');
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}