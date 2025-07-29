import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// SEP-24: Hosted/interactive deposit and withdrawal
// Simplified version for Node.js environment

export interface SEP24Info {
  deposit: {
    [assetCode: string]: {
      enabled: boolean;
      authentication_required?: boolean;
      min_amount?: number;
      max_amount?: number;
      fee_fixed?: number;
      fee_percent?: number;
    };
  };
  withdraw: {
    [assetCode: string]: {
      enabled: boolean;
      authentication_required?: boolean;
      min_amount?: number;
      max_amount?: number;
      fee_fixed?: number;
      fee_percent?: number;
    };
  };
  fee: {
    enabled: boolean;
    authentication_required?: boolean;
  };
  features: {
    account_creation?: boolean;
    claimable_balances?: boolean;
  };
}

export interface SEP24InteractiveResponse {
  type: 'interactive_customer_info_needed';
  url: string;
  id: string;
}

export interface SEP24TransactionResponse {
  transaction: {
    id: string;
    kind: string;
    status: string;
    status_eta?: number;
    amount_in?: string;
    amount_out?: string;
    amount_fee?: string;
    started_at?: string;
    completed_at?: string;
    stellar_transaction_id?: string;
    external_transaction_id?: string;
    withdraw_anchor_account?: string;
    withdraw_memo?: string;
    withdraw_memo_type?: string;
  };
}

// 

export class SEP24Service {
  private anchorEndpoints: Map<string, string>;

  constructor() {
    this.anchorEndpoints = new Map([
      ['CLICK_PHP', 'https://api.clickpeso.com'],
      ['COWRIE_NGN', 'https://api.cowrie.exchange'],
      ['VIBRANT_USD', 'https://vibrant.stellar.org'],
      ['SETTLE_EUR', 'https://api.settle.network']
    ]);
  }

  // Get SEP-24 capabilities
  async getInfo(anchorCode: string): Promise<SEP24Info> {
    const endpoint = this.anchorEndpoints.get(anchorCode);
    if (!endpoint) throw new Error(`Unknown anchor: ${anchorCode}`);

    const response = await axios.get(`${endpoint}/sep24/info`);
    return response.data;
  }

  // Initiate interactive withdrawal
  async initiateWithdraw(params: {
    anchorCode: string;
    asset_code: string;
    amount?: string;
    account: string;
    lang?: string;
    on_change_callback?: string;
    country_code?: string;
    claimable_balance_supported?: boolean;
    customer_id?: string;
    location_id?: string;
    sep9?: {
      first_name?: string;
      last_name?: string;
      email_address?: string;
      mobile_number?: string;
      bank_account_number?: string;
      bank_name?: string;
      bank_routing_number?: string;
    };
  }): Promise<SEP24InteractiveResponse> {
    const endpoint = this.anchorEndpoints.get(params.anchorCode);
    if (!endpoint) throw new Error(`Unknown anchor: ${params.anchorCode}`);

    const requestData: any = {
      asset_code: params.asset_code,
      account: params.account
    };

    if (params.amount) requestData.amount = params.amount;
    if (params.lang) requestData.lang = params.lang;
    if (params.on_change_callback) requestData.on_change_callback = params.on_change_callback;
    if (params.country_code) requestData.country_code = params.country_code;
    if (params.claimable_balance_supported) requestData.claimable_balance_supported = params.claimable_balance_supported;
    if (params.customer_id) requestData.customer_id = params.customer_id;
    if (params.location_id) requestData.location_id = params.location_id;

    // Add SEP-9 fields if provided
    if (params.sep9) {
      Object.entries(params.sep9).forEach(([key, value]) => {
        requestData[`sep9_${key}`] = value;
      });
    }

    try {
      const response = await axios.post(
        `${endpoint}/sep24/transactions/withdraw/interactive`,
        requestData
      );

      return response.data;
    } catch (error: any) {
      console.error('SEP-24 withdraw error:', error.response?.data || error);
      throw new Error(`Interactive withdrawal failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // Get transaction status
  async getTransactionStatus(
    transactionId: string
  ): Promise<SEP24TransactionResponse> {
    // Try all known anchors since we might not know which one
    for (const [anchorCode, endpoint] of this.anchorEndpoints) {
      try {
        const response = await axios.get(
          `${endpoint}/sep24/transaction`,
          {
            params: { id: transactionId }
          }
        );
        return response.data;
      } catch (error) {
        // Try next anchor
        continue;
      }
    }
    
    throw new Error('Transaction not found');
  }

  // Poll transaction status
  async pollTransactionStatus(
    transactionId: string,
    intervalMs: number = 5000,
    maxAttempts: number = 60
  ): Promise<SEP24TransactionResponse> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const status = await this.getTransactionStatus(transactionId);
        
        if (status.transaction.status === 'completed' || 
            status.transaction.status === 'error' ||
            status.transaction.status === 'expired') {
          return status;
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        attempts++;
      } catch (error) {
        console.error('Error polling transaction:', error);
        attempts++;
      }
    }
    
    throw new Error('Transaction polling timeout');
  }

  // Get callback URL for receiving updates
  generateCallbackUrl(transactionId: string): string {
    // In production, this would be your actual server endpoint
    return `https://api.remitdex.com/callbacks/sep24/${transactionId}`;
  }

  // Helper to determine if SEP-6 or SEP-24 should be used
  async recommendProtocol(
    anchorCode: string,
    assetCode: string
  ): Promise<'sep6' | 'sep24'> {
    try {
      // Check if anchor supports both
      const [sep6Info, sep24Info] = await Promise.all([
        this.getSEP6Info(anchorCode).catch(() => null),
        this.getInfo(anchorCode).catch(() => null)
      ]);

      // If only one is supported, use that
      if (sep6Info && !sep24Info) return 'sep6';
      if (!sep6Info && sep24Info) return 'sep24';
      
      // If both supported, check if SEP-24 requires authentication
      if (sep24Info?.withdraw?.[assetCode]?.authentication_required) {
        return 'sep24'; // Use interactive flow for KYC
      }

      // Default to programmatic (SEP-6) for better UX
      return 'sep6';
    } catch (error) {
      // Default to SEP-24 if unsure
      return 'sep24';
    }
  }

  private async getSEP6Info(anchorCode: string): Promise<any> {
    const endpoint = this.anchorEndpoints.get(anchorCode);
    if (!endpoint) throw new Error(`Unknown anchor: ${anchorCode}`);
    
    const response = await axios.get(`${endpoint}/sep6/info`);
    return response.data;
  }

  // Get SEP-24 interactive URL info
  getInteractiveInstructions(response: SEP24InteractiveResponse): string {
    return `
To complete this transaction, please visit:
${response.url}

Transaction ID: ${response.id}

This URL will open the anchor's KYC/compliance form where you can:
1. Verify your identity
2. Provide recipient details
3. Complete any additional requirements

The transaction will be processed once you complete the form.
    `.trim();
  }
}