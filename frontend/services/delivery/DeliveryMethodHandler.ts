import { SEP6Service } from '../anchors/SEP6Service';
import { SEP24Service } from '../anchors/SEP24Service';

export interface DeliveryMethod {
  id: string;
  name: string;
  type: 'bank_transfer' | 'gcash' | 'paymaya' | 'mobile_money' | 'cash_pickup';
  countryCode: string;
  currency: string;
  minAmount: number;
  maxAmount: number;
  estimatedTime: number; // in minutes
  fee: {
    fixed: number;
    percentage: number;
  };
  requiredFields: DeliveryField[];
  icon?: string;
  description?: string;
}

export interface DeliveryField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'tel' | 'email' | 'select';
  required: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    options?: string[];
  };
  placeholder?: string;
  helpText?: string;
}

export interface DeliveryRequest {
  method: string;
  amount: string;
  currency: string;
  recipient: {
    [fieldName: string]: string;
  };
  senderAccount: string;
  anchorCode: string;
}

export class DeliveryMethodHandler {
  private sep6Service: SEP6Service;
  private sep24Service: SEP24Service;
  private deliveryMethods: Map<string, DeliveryMethod>;

  constructor() {
    this.sep6Service = new SEP6Service();
    this.sep24Service = new SEP24Service();
    this.deliveryMethods = new Map();
    this.initializeDeliveryMethods();
  }

  private initializeDeliveryMethods() {
    // Philippines - GCash
    this.deliveryMethods.set('gcash_php', {
      id: 'gcash_php',
      name: 'GCash',
      type: 'gcash',
      countryCode: 'PH',
      currency: 'PHP',
      minAmount: 100,
      maxAmount: 500000,
      estimatedTime: 1,
      fee: { fixed: 0, percentage: 0.5 },
      requiredFields: [
        {
          name: 'phone_number',
          label: 'GCash Mobile Number',
          type: 'tel',
          required: true,
          validation: {
            pattern: '^\\+639\\d{9}$',
            minLength: 13,
            maxLength: 13
          },
          placeholder: '+639123456789',
          helpText: 'Philippine mobile number registered with GCash'
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          required: true,
          validation: {
            minLength: 2,
            maxLength: 100
          },
          placeholder: 'Juan Dela Cruz',
          helpText: 'Full name as registered in GCash'
        }
      ],
      icon: '📱',
      description: 'Instant transfer to GCash mobile wallet'
    });

    // Philippines - PayMaya
    this.deliveryMethods.set('paymaya_php', {
      id: 'paymaya_php',
      name: 'PayMaya',
      type: 'paymaya',
      countryCode: 'PH',
      currency: 'PHP',
      minAmount: 100,
      maxAmount: 500000,
      estimatedTime: 1,
      fee: { fixed: 0, percentage: 0.5 },
      requiredFields: [
        {
          name: 'phone_number',
          label: 'PayMaya Mobile Number',
          type: 'tel',
          required: true,
          validation: {
            pattern: '^\\+639\\d{9}$',
            minLength: 13,
            maxLength: 13
          },
          placeholder: '+639123456789',
          helpText: 'Philippine mobile number registered with PayMaya'
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          required: true,
          validation: {
            minLength: 2,
            maxLength: 100
          },
          placeholder: 'Juan Dela Cruz'
        }
      ],
      icon: '💳',
      description: 'Instant transfer to PayMaya wallet'
    });

    // Philippines - Bank Transfer
    this.deliveryMethods.set('bank_ph', {
      id: 'bank_ph',
      name: 'Bank Transfer',
      type: 'bank_transfer',
      countryCode: 'PH',
      currency: 'PHP',
      minAmount: 1000,
      maxAmount: 1000000,
      estimatedTime: 60,
      fee: { fixed: 50, percentage: 0.3 },
      requiredFields: [
        {
          name: 'bank_name',
          label: 'Bank Name',
          type: 'select',
          required: true,
          validation: {
            options: ['BDO', 'BPI', 'Metrobank', 'UnionBank', 'Security Bank', 'PNB', 'Landbank']
          },
          placeholder: 'Select bank'
        },
        {
          name: 'account_number',
          label: 'Account Number',
          type: 'text',
          required: true,
          validation: {
            pattern: '^[0-9]{10,16}$',
            minLength: 10,
            maxLength: 16
          },
          placeholder: '1234567890'
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          required: true,
          validation: {
            minLength: 2,
            maxLength: 100
          },
          placeholder: 'Juan Dela Cruz'
        }
      ],
      icon: '🏦',
      description: 'Direct transfer to Philippine bank account'
    });

    // Nigeria - Mobile Money
    this.deliveryMethods.set('mobile_money_ngn', {
      id: 'mobile_money_ngn',
      name: 'Mobile Money',
      type: 'mobile_money',
      countryCode: 'NG',
      currency: 'NGN',
      minAmount: 1000,
      maxAmount: 5000000,
      estimatedTime: 5,
      fee: { fixed: 100, percentage: 0.6 },
      requiredFields: [
        {
          name: 'phone_number',
          label: 'Mobile Number',
          type: 'tel',
          required: true,
          validation: {
            pattern: '^\\+234[789]\\d{9}$',
            minLength: 14,
            maxLength: 14
          },
          placeholder: '+2348012345678',
          helpText: 'Nigerian mobile number'
        },
        {
          name: 'provider',
          label: 'Mobile Money Provider',
          type: 'select',
          required: true,
          validation: {
            options: ['MTN MoMo', 'Airtel Money', 'Glo Cash', '9mobile Cash']
          }
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          required: true,
          validation: {
            minLength: 2,
            maxLength: 100
          }
        }
      ],
      icon: '📲',
      description: 'Transfer to Nigerian mobile money wallet'
    });

    // Nigeria - Bank Transfer
    this.deliveryMethods.set('bank_ngn', {
      id: 'bank_ngn',
      name: 'Bank Transfer',
      type: 'bank_transfer',
      countryCode: 'NG',
      currency: 'NGN',
      minAmount: 5000,
      maxAmount: 10000000,
      estimatedTime: 120,
      fee: { fixed: 200, percentage: 0.4 },
      requiredFields: [
        {
          name: 'bank_name',
          label: 'Bank Name',
          type: 'select',
          required: true,
          validation: {
            options: ['First Bank', 'GTBank', 'Access Bank', 'Zenith Bank', 'UBA', 'Sterling Bank']
          }
        },
        {
          name: 'account_number',
          label: 'NUBAN Account Number',
          type: 'text',
          required: true,
          validation: {
            pattern: '^[0-9]{10}$',
            minLength: 10,
            maxLength: 10
          },
          placeholder: '0123456789',
          helpText: '10-digit NUBAN account number'
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          required: true
        }
      ],
      icon: '🏦',
      description: 'Direct transfer to Nigerian bank account'
    });

    // Argentina - Bank Transfer
    this.deliveryMethods.set('bank_ars', {
      id: 'bank_ars',
      name: 'Bank Transfer',
      type: 'bank_transfer',
      countryCode: 'AR',
      currency: 'ARS',
      minAmount: 1000,
      maxAmount: 5000000,
      estimatedTime: 1440, // 24 hours
      fee: { fixed: 500, percentage: 0.7 },
      requiredFields: [
        {
          name: 'cbu_cvu',
          label: 'CBU/CVU',
          type: 'text',
          required: true,
          validation: {
            pattern: '^[0-9]{22}$',
            minLength: 22,
            maxLength: 22
          },
          placeholder: '0123456789012345678901',
          helpText: '22-digit CBU or CVU number'
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          required: true
        },
        {
          name: 'cuit_cuil',
          label: 'CUIT/CUIL',
          type: 'text',
          required: true,
          validation: {
            pattern: '^[0-9]{11}$',
            minLength: 11,
            maxLength: 11
          },
          placeholder: '20123456789',
          helpText: 'Tax identification number'
        }
      ],
      icon: '🏦',
      description: 'Transfer to Argentine bank account'
    });
  }

  // Get available delivery methods for a country/currency
  getAvailableDeliveryMethods(
    countryCode: string,
    currency: string
  ): DeliveryMethod[] {
    return Array.from(this.deliveryMethods.values()).filter(
      method => method.countryCode === countryCode && method.currency === currency
    );
  }

  // Validate delivery request
  validateDeliveryRequest(request: DeliveryRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const method = this.deliveryMethods.get(request.method);

    if (!method) {
      errors.push('Invalid delivery method');
      return { valid: false, errors };
    }

    // Validate amount
    const amount = parseFloat(request.amount);
    if (amount < method.minAmount) {
      errors.push(`Amount below minimum of ${method.minAmount} ${method.currency}`);
    }
    if (amount > method.maxAmount) {
      errors.push(`Amount exceeds maximum of ${method.maxAmount} ${method.currency}`);
    }

    // Validate required fields
    for (const field of method.requiredFields) {
      const value = request.recipient[field.name];

      if (field.required && !value) {
        errors.push(`${field.label} is required`);
        continue;
      }

      if (value && field.validation) {
        // Pattern validation
        if (field.validation.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            errors.push(`${field.label} format is invalid`);
          }
        }

        // Length validation
        if (field.validation.minLength && value.length < field.validation.minLength) {
          errors.push(`${field.label} is too short`);
        }
        if (field.validation.maxLength && value.length > field.validation.maxLength) {
          errors.push(`${field.label} is too long`);
        }

        // Options validation
        if (field.validation.options && !field.validation.options.includes(value)) {
          errors.push(`${field.label} must be one of: ${field.validation.options.join(', ')}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Process delivery request
  async processDelivery(request: DeliveryRequest): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    // Validate request
    const validation = this.validateDeliveryRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    const method = this.deliveryMethods.get(request.method)!;

    try {
      // Authenticate with anchor
      await this.sep6Service.authenticate(request.anchorCode, request.senderAccount);

      // Build withdrawal params based on delivery method
      const withdrawParams: any = {
        anchorCode: request.anchorCode,
        asset_code: request.currency,
        amount: request.amount,
        type: method.type,
        account: request.senderAccount
      };

      // Add method-specific parameters
      switch (method.type) {
        case 'gcash':
        case 'paymaya':
          withdrawParams.gcash = {
            phone_number: request.recipient.phone_number,
            account_name: request.recipient.account_name
          };
          break;

        case 'mobile_money':
          withdrawParams.mobile_money = {
            phone_number: request.recipient.phone_number,
            provider: request.recipient.provider,
            account_name: request.recipient.account_name
          };
          break;

        case 'bank_transfer':
          if (method.countryCode === 'PH') {
            withdrawParams.bank_account = {
              account_number: request.recipient.account_number,
              bank_name: request.recipient.bank_name
            };
          } else if (method.countryCode === 'NG') {
            withdrawParams.bank_account = {
              account_number: request.recipient.account_number,
              bank_name: request.recipient.bank_name
            };
          } else if (method.countryCode === 'AR') {
            withdrawParams.dest = request.recipient.cbu_cvu;
            withdrawParams.dest_extra = JSON.stringify({
              cuit_cuil: request.recipient.cuit_cuil,
              account_name: request.recipient.account_name
            });
          }
          break;
      }

      // Process withdrawal
      const result = await this.sep6Service.withdraw(withdrawParams);

      return {
        success: true,
        transactionId: result.id
      };
    } catch (error: any) {
      console.error('Delivery processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Calculate delivery fee
  calculateDeliveryFee(
    method: string,
    amount: number
  ): {
    fixed: number;
    percentage: number;
    total: number;
  } {
    const deliveryMethod = this.deliveryMethods.get(method);
    if (!deliveryMethod) {
      throw new Error('Invalid delivery method');
    }

    const fixed = deliveryMethod.fee.fixed;
    const percentage = amount * (deliveryMethod.fee.percentage / 100);
    const total = fixed + percentage;

    return { fixed, percentage, total };
  }

  // Get delivery status
  async getDeliveryStatus(
    anchorCode: string,
    transactionId: string
  ): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    details?: any;
  }> {
    try {
      const result = await this.sep6Service.getWithdrawStatus(anchorCode, transactionId);
      
      // Map anchor status to our status
      const statusMap: Record<string, any> = {
        'incomplete': 'pending',
        'pending_user_transfer_start': 'pending',
        'pending_anchor': 'processing',
        'pending_stellar': 'processing',
        'pending_external': 'processing',
        'completed': 'completed',
        'error': 'failed',
        'expired': 'failed'
      };

      return {
        status: statusMap[result.transaction.status] || 'pending',
        details: result.transaction
      };
    } catch (error) {
      console.error('Failed to get delivery status:', error);
      return { status: 'pending' };
    }
  }
}