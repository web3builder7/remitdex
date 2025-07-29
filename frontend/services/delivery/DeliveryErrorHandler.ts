import { EventEmitter } from 'events';
import { OrderRepository } from '../database/OrderRepository';
import { MetricsCollector } from '../monitoring/MetricsCollector';

export enum DeliveryErrorType {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_RECIPIENT = 'INVALID_RECIPIENT',
  KYC_REQUIRED = 'KYC_REQUIRED',
  COMPLIANCE_BLOCKED = 'COMPLIANCE_BLOCKED',
  ANCHOR_UNAVAILABLE = 'ANCHOR_UNAVAILABLE',
  RATE_EXPIRED = 'RATE_EXPIRED',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  TECHNICAL_ERROR = 'TECHNICAL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT'
}

export interface DeliveryError {
  type: DeliveryErrorType;
  message: string;
  code?: string;
  details?: any;
  retryable: boolean;
  userAction?: string;
  estimatedResolution?: number; // minutes
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number; // milliseconds
  maxDelay: number;
  retryableErrors: DeliveryErrorType[];
}

export class DeliveryErrorHandler extends EventEmitter {
  private orderRepository: OrderRepository;
  private metricsCollector: MetricsCollector;
  private retryQueues: Map<string, NodeJS.Timeout>;
  private retryAttempts: Map<string, number>;
  private retryPolicies: Map<string, RetryPolicy>;

  constructor(
    orderRepository: OrderRepository,
    metricsCollector: MetricsCollector
  ) {
    super();
    this.orderRepository = orderRepository;
    this.metricsCollector = metricsCollector;
    this.retryQueues = new Map();
    this.retryAttempts = new Map();
    this.retryPolicies = new Map();
    this.initializeRetryPolicies();
  }

  private initializeRetryPolicies() {
    // Default retry policy
    this.retryPolicies.set('default', {
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelay: 5000, // 5 seconds
      maxDelay: 300000, // 5 minutes
      retryableErrors: [
        DeliveryErrorType.ANCHOR_UNAVAILABLE,
        DeliveryErrorType.NETWORK_ERROR,
        DeliveryErrorType.TIMEOUT,
        DeliveryErrorType.TECHNICAL_ERROR
      ]
    });

    // Aggressive retry for rate expiration
    this.retryPolicies.set('rate_expired', {
      maxAttempts: 1,
      backoffMultiplier: 1,
      initialDelay: 0,
      maxDelay: 0,
      retryableErrors: [DeliveryErrorType.RATE_EXPIRED]
    });

    // No retry for compliance issues
    this.retryPolicies.set('compliance', {
      maxAttempts: 0,
      backoffMultiplier: 1,
      initialDelay: 0,
      maxDelay: 0,
      retryableErrors: []
    });
  }

  // Handle delivery error
  async handleDeliveryError(
    orderId: string,
    error: any,
    context?: any
  ): Promise<DeliveryError> {
    const deliveryError = this.classifyError(error, context);
    
    // Log error
    console.error(`Delivery error for order ${orderId}:`, deliveryError);
    
    // Update order status
    await this.orderRepository.updateStatus(orderId, 'failed');

    // Emit error event
    this.emit('delivery-error', {
      orderId,
      error: deliveryError,
      timestamp: new Date()
    });

    // Check if retryable
    if (deliveryError.retryable) {
      await this.scheduleRetry(orderId, deliveryError);
    } else {
      // Non-retryable error - initiate refund if needed
      await this.handleNonRetryableError(orderId, deliveryError);
    }

    return deliveryError;
  }

  // Classify error type
  private classifyError(error: any, context?: any): DeliveryError {
    const errorMessage = error.message || error.toString();
    const errorCode = error.code || error.response?.data?.error_code;

    // Check for specific error patterns
    if (errorMessage.includes('insufficient') || errorCode === 'INSUFFICIENT_BALANCE') {
      return {
        type: DeliveryErrorType.INSUFFICIENT_FUNDS,
        message: 'Insufficient funds in anchor reserve',
        code: errorCode,
        retryable: true,
        userAction: 'Please try again in a few minutes',
        estimatedResolution: 15
      };
    }

    if (errorMessage.includes('invalid recipient') || errorCode === 'INVALID_DEST') {
      return {
        type: DeliveryErrorType.INVALID_RECIPIENT,
        message: 'Recipient details are invalid or incomplete',
        code: errorCode,
        retryable: false,
        userAction: 'Please verify recipient information and try again'
      };
    }

    if (errorMessage.includes('KYC') || errorCode === 'NEEDS_INFO') {
      return {
        type: DeliveryErrorType.KYC_REQUIRED,
        message: 'Additional KYC information required',
        code: errorCode,
        retryable: false,
        userAction: 'Please complete KYC verification',
        details: error.response?.data?.required_info
      };
    }

    if (errorMessage.includes('compliance') || errorMessage.includes('blocked')) {
      return {
        type: DeliveryErrorType.COMPLIANCE_BLOCKED,
        message: 'Transaction blocked for compliance reasons',
        code: errorCode,
        retryable: false,
        userAction: 'Please contact support for assistance'
      };
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        type: DeliveryErrorType.ANCHOR_UNAVAILABLE,
        message: 'Anchor service temporarily unavailable',
        code: error.code,
        retryable: true,
        estimatedResolution: 30
      };
    }

    if (errorMessage.includes('rate expired') || errorCode === 'RATE_EXPIRED') {
      return {
        type: DeliveryErrorType.RATE_EXPIRED,
        message: 'Exchange rate expired',
        code: errorCode,
        retryable: true,
        userAction: 'Getting new rate...'
      };
    }

    if (errorMessage.includes('limit exceeded') || errorCode === 'LIMIT_EXCEEDED') {
      return {
        type: DeliveryErrorType.LIMIT_EXCEEDED,
        message: 'Transaction limit exceeded',
        code: errorCode,
        retryable: false,
        userAction: 'Please reduce amount or complete additional verification',
        details: error.response?.data?.limits
      };
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return {
        type: DeliveryErrorType.TIMEOUT,
        message: 'Request timed out',
        code: error.code,
        retryable: true,
        estimatedResolution: 5
      };
    }

    if (error.code && error.code.startsWith('E')) {
      return {
        type: DeliveryErrorType.NETWORK_ERROR,
        message: 'Network error occurred',
        code: error.code,
        retryable: true,
        estimatedResolution: 10
      };
    }

    // Default technical error
    return {
      type: DeliveryErrorType.TECHNICAL_ERROR,
      message: 'An unexpected error occurred',
      code: errorCode,
      details: errorMessage,
      retryable: true,
      estimatedResolution: 60
    };
  }

  // Schedule retry
  private async scheduleRetry(orderId: string, error: DeliveryError) {
    const attempts = this.retryAttempts.get(orderId) || 0;
    const policy = this.getRetryPolicy(error.type);

    if (attempts >= policy.maxAttempts) {
      console.log(`Max retry attempts reached for order ${orderId}`);
      await this.handleMaxRetriesExceeded(orderId, error);
      return;
    }

    const delay = Math.min(
      policy.initialDelay * Math.pow(policy.backoffMultiplier, attempts),
      policy.maxDelay
    );

    console.log(`Scheduling retry for order ${orderId} in ${delay}ms (attempt ${attempts + 1}/${policy.maxAttempts})`);

    // Clear existing retry if any
    const existingTimeout = this.retryQueues.get(orderId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new retry
    const timeout = setTimeout(async () => {
      this.retryQueues.delete(orderId);
      this.retryAttempts.set(orderId, attempts + 1);
      
      // Emit retry event
      this.emit('delivery-retry', {
        orderId,
        attempt: attempts + 1,
        maxAttempts: policy.maxAttempts
      });

      // Actual retry logic would go here
      // This would call back to the delivery service
    }, delay);

    this.retryQueues.set(orderId, timeout);
  }

  // Get retry policy
  private getRetryPolicy(errorType: DeliveryErrorType): RetryPolicy {
    if (errorType === DeliveryErrorType.RATE_EXPIRED) {
      return this.retryPolicies.get('rate_expired')!;
    }
    if (errorType === DeliveryErrorType.COMPLIANCE_BLOCKED || 
        errorType === DeliveryErrorType.KYC_REQUIRED) {
      return this.retryPolicies.get('compliance')!;
    }
    return this.retryPolicies.get('default')!;
  }

  // Handle non-retryable error
  private async handleNonRetryableError(orderId: string, error: DeliveryError) {
    // Update order with permanent failure
    await this.orderRepository.updateStatus(orderId, 'failed');

    // Emit event for refund processing
    this.emit('refund-required', {
      orderId,
      reason: error.message,
      errorType: error.type
    });

    // Send notification to user
    this.emit('user-notification', {
      orderId,
      type: 'delivery_failed',
      message: error.userAction || 'Your transaction could not be completed. A refund will be processed.',
      severity: 'error'
    });
  }

  // Handle max retries exceeded
  private async handleMaxRetriesExceeded(orderId: string, error: DeliveryError) {
    // Clean up retry tracking
    this.retryAttempts.delete(orderId);

    // Update order status
    await this.orderRepository.updateStatus(orderId, 'failed');

    // Emit event for manual intervention
    this.emit('manual-review-required', {
      orderId,
      reason: 'Max retries exceeded',
      lastError: error
    });

    // Send notification
    this.emit('user-notification', {
      orderId,
      type: 'delivery_delayed',
      message: 'Your transaction is being reviewed. We\'ll update you within 24 hours.',
      severity: 'warning'
    });
  }

  // Cancel all retries for an order
  cancelRetries(orderId: string) {
    const timeout = this.retryQueues.get(orderId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryQueues.delete(orderId);
    }
    this.retryAttempts.delete(orderId);
  }

  // Get retry status
  getRetryStatus(orderId: string): {
    isRetrying: boolean;
    attempts: number;
    nextRetryIn?: number;
  } {
    const isRetrying = this.retryQueues.has(orderId);
    const attempts = this.retryAttempts.get(orderId) || 0;

    return {
      isRetrying,
      attempts,
      nextRetryIn: isRetrying ? undefined : 0 // Would need to track actual time
    };
  }

  // Generate user-friendly error message
  getUserFriendlyMessage(error: DeliveryError): string {
    const messages: Record<DeliveryErrorType, string> = {
      [DeliveryErrorType.INSUFFICIENT_FUNDS]: 'Service temporarily unavailable. Please try again in 15 minutes.',
      [DeliveryErrorType.INVALID_RECIPIENT]: 'The recipient information provided is invalid. Please check and try again.',
      [DeliveryErrorType.KYC_REQUIRED]: 'Additional verification is required to complete this transaction.',
      [DeliveryErrorType.COMPLIANCE_BLOCKED]: 'This transaction cannot be processed due to regulatory requirements.',
      [DeliveryErrorType.ANCHOR_UNAVAILABLE]: 'Our delivery partner is temporarily unavailable. We\'re working on it.',
      [DeliveryErrorType.RATE_EXPIRED]: 'The exchange rate has expired. Getting you a new quote...',
      [DeliveryErrorType.LIMIT_EXCEEDED]: 'This amount exceeds your transaction limit.',
      [DeliveryErrorType.TECHNICAL_ERROR]: 'Something went wrong. Our team has been notified.',
      [DeliveryErrorType.NETWORK_ERROR]: 'Connection issue. Please check your internet and try again.',
      [DeliveryErrorType.TIMEOUT]: 'The request took too long. Please try again.'
    };

    return messages[error.type] || error.message;
  }

  // Get error statistics
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<DeliveryErrorType, number>;
    retrySuccessRate: number;
  } {
    // In production, this would query actual metrics
    return {
      totalErrors: 0,
      errorsByType: {} as Record<DeliveryErrorType, number>,
      retrySuccessRate: 0
    };
  }
}