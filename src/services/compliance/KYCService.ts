export interface KYCData {
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  idDocument: {
    type: 'passport' | 'national_id' | 'drivers_license';
    number: string;
    expiryDate: string;
    issuingCountry: string;
  };
  phoneNumber: string;
  email: string;
}

export interface KYCResult {
  status: 'pending' | 'approved' | 'rejected' | 'requires_review';
  riskScore: number;
  verificationId: string;
  checks: {
    identityVerified: boolean;
    addressVerified: boolean;
    sanctionsCheck: boolean;
    pepCheck: boolean; // Politically Exposed Person
  };
  reason?: string;
}

export class KYCService {
  private userKYCStatus: Map<string, KYCResult> = new Map();
  private transactionLimits: Map<string, number> = new Map([
    ['unverified', 0],
    ['basic', 1000],      // $1,000 per transaction
    ['verified', 10000],  // $10,000 per transaction
    ['premium', 50000]    // $50,000 per transaction
  ]);

  async submitKYC(data: KYCData): Promise<KYCResult> {
    // In production, this would call actual KYC provider APIs
    // like Jumio, Onfido, or Sumsub
    
    const verificationId = `KYC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate KYC checks
    const result: KYCResult = {
      status: 'pending',
      riskScore: 0,
      verificationId,
      checks: {
        identityVerified: false,
        addressVerified: false,
        sanctionsCheck: false,
        pepCheck: false
      }
    };

    // Simulate async verification process
    setTimeout(() => {
      this.processKYCVerification(data.userId, verificationId);
    }, 5000);

    this.userKYCStatus.set(data.userId, result);
    return result;
  }

  private async processKYCVerification(userId: string, verificationId: string) {
    const result = this.userKYCStatus.get(userId);
    if (!result) return;

    // Simulate verification logic
    const riskScore = Math.random() * 100;
    
    result.riskScore = riskScore;
    result.checks = {
      identityVerified: riskScore < 80,
      addressVerified: riskScore < 70,
      sanctionsCheck: riskScore < 90,
      pepCheck: riskScore < 95
    };

    if (riskScore < 30) {
      result.status = 'approved';
    } else if (riskScore < 70) {
      result.status = 'requires_review';
      result.reason = 'Additional documentation required';
    } else {
      result.status = 'rejected';
      result.reason = 'Failed risk assessment';
    }

    this.userKYCStatus.set(userId, result);
  }

  async getKYCStatus(userId: string): Promise<KYCResult | null> {
    return this.userKYCStatus.get(userId) || null;
  }

  async checkTransactionLimit(userId: string, amount: number): Promise<{
    allowed: boolean;
    limit: number;
    reason?: string;
  }> {
    const kycStatus = await this.getKYCStatus(userId);
    
    let userLevel = 'unverified';
    if (kycStatus?.status === 'approved') {
      if (kycStatus.riskScore < 10) {
        userLevel = 'premium';
      } else if (kycStatus.riskScore < 30) {
        userLevel = 'verified';
      } else {
        userLevel = 'basic';
      }
    }

    const limit = this.transactionLimits.get(userLevel) || 0;
    const allowed = amount <= limit;

    return {
      allowed,
      limit,
      reason: allowed ? undefined : `Transaction exceeds ${userLevel} limit of $${limit}`
    };
  }

  async performAMLCheck(
    userId: string,
    transaction: {
      amount: number;
      source: string;
      destination: string;
      currency: string;
    }
  ): Promise<{
    passed: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    flags: string[];
  }> {
    const flags: string[] = [];
    
    // Check for suspicious patterns
    if (transaction.amount > 9999) {
      flags.push('Large transaction');
    }
    
    if (transaction.amount === 9999 || transaction.amount === 4999) {
      flags.push('Structuring suspected');
    }
    
    // Check high-risk countries
    const highRiskCountries = ['KP', 'IR', 'SY'];
    if (highRiskCountries.includes(transaction.destination)) {
      flags.push('High-risk destination');
    }

    // Calculate risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (flags.length === 0) {
      riskLevel = 'low';
    } else if (flags.length === 1) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    return {
      passed: riskLevel !== 'high',
      riskLevel,
      flags
    };
  }

  async generateComplianceReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    const kycStatus = await this.getKYCStatus(userId);
    
    const report = {
      userId,
      reportPeriod: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      kycStatus: kycStatus || 'Not submitted',
      transactionSummary: {
        // In production, would fetch from transaction history
        totalVolume: 0,
        transactionCount: 0,
        averageTransaction: 0
      },
      complianceChecks: {
        sanctionsScreening: 'Passed',
        amlMonitoring: 'Active',
        transactionMonitoring: 'No alerts'
      },
      generatedAt: new Date().toISOString()
    };

    return JSON.stringify(report, null, 2);
  }

  // SEP-12 compliance for Stellar anchors
  async getSEP12Fields(anchorCode: string): Promise<any> {
    // Return required KYC fields for specific anchor
    const sep12Fields = {
      'CLICK_PHP': {
        required: ['first_name', 'last_name', 'id_number', 'id_type', 'address'],
        optional: ['mobile_number', 'email']
      },
      'COWRIE_NGN': {
        required: ['full_name', 'bvn', 'address', 'phone_number'],
        optional: ['email', 'id_document']
      },
      'VIBRANT_USD': {
        required: ['first_name', 'last_name', 'ssn', 'address', 'date_of_birth'],
        optional: ['phone_number', 'email']
      }
    };

    return sep12Fields[anchorCode] || {};
  }
}