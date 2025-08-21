import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface MyPVitConfig {
  baseUrl: string;
  merchantSlug: string;
  secretKey: string;
  environment: 'test' | 'production';
}

export interface MyPVitPaymentRequest {
  amount: number;
  currency: string;
  reference: string;
  description: string;
  customerPhone?: string;
  customerEmail?: string;
  callbackUrl?: string;
  returnUrl?: string;
}

export interface MyPVitPaymentResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  message?: string;
  errorCode?: string;
}

export interface MyPVitTransactionStatus {
  transactionId: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  reference: string;
  message?: string;
}

@Injectable()
export class MyPVitService {
  private readonly logger = new Logger(MyPVitService.name);
  private readonly httpClient: AxiosInstance;
  private readonly config: MyPVitConfig;
  private readonly secretsManager: SecretsManagerClient;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      baseUrl:
        this.configService.get<string>('MYPVIT_BASE_URL') ||
        'https://api.mypvit.pro',
      merchantSlug:
        this.configService.get<string>('MYPVIT_MERCHANT_SLUG') ||
        'MR_1755783875',
      secretKey: '', // Will be fetched from AWS Secrets Manager
      environment:
        (this.configService.get<string>('MYPVIT_ENVIRONMENT') as
          | 'test'
          | 'production') || 'test',
    };

    // Initialize AWS Secrets Manager client
    this.secretsManager = new SecretsManagerClient({
      region: this.configService.get<string>('AWS_REGION') || 'ca-central-1',
    });

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use(async (config) => {
      // Fetch secret from AWS Secrets Manager for every request
      const secretKey = await this.getSecretKey();

      const timestamp = Date.now().toString();
      const signature = this.generateSignature(
        config.data,
        timestamp,
        secretKey
      );

      config.headers['Content-Type'] = 'application/json';
      config.headers['X-Secret'] = secretKey;
      config.headers['X-Callback-MediaType'] = 'application/json';
      config.headers['X-Merchant-Slug'] = this.config.merchantSlug;
      config.headers['X-Timestamp'] = timestamp;
      config.headers['X-Signature'] = signature;

      return config;
    });

    // Add response interceptor for logging
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `MyPVit API Response: ${response.status}`,
          response.data
        );
        return response;
      },
      (error) => {
        this.logger.error(
          'MyPVit API Error:',
          error.response?.data || error.message
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get secret key from AWS Secrets Manager
   */
  private async getSecretKey(): Promise<string> {
    try {
      const environment =
        this.configService.get<string>('NODE_ENV') || 'development';
      const secretName = `${environment}-rendasua-backend-secrets`;

      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await this.secretsManager.send(command);

      if (!response.SecretString) {
        throw new Error('Secret value is empty or not found');
      }

      const secretData = JSON.parse(response.SecretString);
      const secretKey = secretData.MYPVIT_SECRET_KEY;

      if (!secretKey) {
        throw new Error('MYPVIT_SECRET_KEY not found in secret');
      }

      return secretKey;
    } catch (error) {
      this.logger.error(
        'Failed to get secret key from AWS Secrets Manager:',
        error
      );
      throw new Error('Failed to get MyPVit secret key');
    }
  }

  /**
   * Generate signature for API authentication
   */
  private generateSignature(
    data: any,
    timestamp: string,
    secretKey: string
  ): string {
    const payload = JSON.stringify(data) + timestamp + secretKey;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Initialize a payment transaction using REST API
   */
  async initiatePayment(
    paymentRequest: MyPVitPaymentRequest
  ): Promise<MyPVitPaymentResponse> {
    try {
      this.logger.log(
        `Initiating payment for reference: ${paymentRequest.reference}`
      );

      const payload = {
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        reference: paymentRequest.reference,
        description: paymentRequest.description,
        customer_phone: paymentRequest.customerPhone,
        customer_email: paymentRequest.customerEmail,
        callback_url: paymentRequest.callbackUrl,
        return_url: paymentRequest.returnUrl,
      };

      // Use the REST endpoint for payment initiation
      const response = await this.httpClient.post(
        '/X5T3RIBYQUDFBZSH/rest',
        payload
      );

      if (response.data.success) {
        return {
          success: true,
          transactionId: response.data.transaction_id,
          paymentUrl: response.data.payment_url,
          message: response.data.message,
        };
      } else {
        return {
          success: false,
          message: response.data.message,
          errorCode: response.data.error_code,
        };
      }
    } catch (error) {
      this.logger.error('Failed to initiate payment:', error);
      return {
        success: false,
        message: 'Failed to initiate payment',
        errorCode: 'INITIATION_FAILED',
      };
    }
  }

  /**
   * Check transaction status using STATUS API
   */
  async checkTransactionStatus(
    transactionId: string
  ): Promise<MyPVitTransactionStatus> {
    try {
      this.logger.log(`Checking transaction status for: ${transactionId}`);

      const response = await this.httpClient.get(
        `/RYXA6SLFNRBFFQJX/status/${transactionId}`
      );

      if (response.data.success) {
        return {
          transactionId: response.data.transaction_id,
          status: response.data.status,
          amount: response.data.amount,
          currency: response.data.currency,
          reference: response.data.reference,
          message: response.data.message,
        };
      } else {
        throw new Error(
          response.data.message || 'Failed to check transaction status'
        );
      }
    } catch (error) {
      this.logger.error('Failed to check transaction status:', error);
      throw error;
    }
  }

  /**
   * Verify payment callback
   */
  async verifyCallback(
    payload: any,
    signature: string,
    timestamp: string
  ): Promise<boolean> {
    try {
      const secretKey = await this.getSecretKey();
      const expectedSignature = this.generateSignature(
        payload,
        timestamp,
        secretKey
      );
      return signature === expectedSignature;
    } catch (error) {
      this.logger.error('Failed to verify callback signature:', error);
      return false;
    }
  }

  /**
   * Get supported payment methods
   */
  async getSupportedPaymentMethods(): Promise<string[]> {
    try {
      // MyPVit supports these payment methods based on their documentation
      return ['mobile_money', 'card', 'bank_transfer'];
    } catch (error) {
      this.logger.error('Failed to get supported payment methods:', error);
      return [];
    }
  }

  /**
   * Cancel a pending transaction
   */
  async cancelTransaction(transactionId: string): Promise<boolean> {
    try {
      this.logger.log(`Cancelling transaction: ${transactionId}`);

      const response = await this.httpClient.post(
        `/RYXA6SLFNRBFFQJX/status/${transactionId}/cancel`
      );

      return response.data.success || false;
    } catch (error) {
      this.logger.error('Failed to cancel transaction:', error);
      return false;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const params = new URLSearchParams();

      if (filters?.startDate) params.append('start_date', filters.startDate);
      if (filters?.endDate) params.append('end_date', filters.endDate);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());

      const response = await this.httpClient.get(
        `/RYXA6SLFNRBFFQJX/status?${params.toString()}`
      );

      if (response.data.success) {
        return response.data.transactions || [];
      } else {
        return [];
      }
    } catch (error) {
      this.logger.error('Failed to get transaction history:', error);
      return [];
    }
  }

  /**
   * Check merchant balance
   */
  async checkBalance(): Promise<{ balance: number; currency: string }> {
    try {
      this.logger.log('Checking merchant balance');

      const response = await this.httpClient.get('/LIRYOTW7QL3DCDPJ/balance');

      if (response.data.success) {
        return {
          balance: response.data.balance,
          currency: response.data.currency,
        };
      } else {
        throw new Error(response.data.message || 'Failed to check balance');
      }
    } catch (error) {
      this.logger.error('Failed to check balance:', error);
      throw error;
    }
  }

  /**
   * Renew secret key
   */
  async renewSecretKey(): Promise<{
    success: boolean;
    newSecretKey?: string;
    message?: string;
  }> {
    try {
      this.logger.log('Renewing secret key');

      const response = await this.httpClient.post(
        '/CTCNJRBWZIDALEGT/renew-secret'
      );

      if (response.data.success) {
        return {
          success: true,
          newSecretKey: response.data.new_secret_key,
          message: response.data.message,
        };
      } else {
        return {
          success: false,
          message: response.data.message,
        };
      }
    } catch (error) {
      this.logger.error('Failed to renew secret key:', error);
      return {
        success: false,
        message: 'Failed to renew secret key',
      };
    }
  }

  /**
   * Perform KYC verification
   */
  async performKYC(kycData: {
    customerPhone: string;
    customerName: string;
    customerId?: string;
    customerEmail?: string;
  }): Promise<{ success: boolean; kycStatus: string; message?: string }> {
    try {
      this.logger.log(`Performing KYC for customer: ${kycData.customerPhone}`);

      const response = await this.httpClient.post(
        '/W2OZPE4QDSWH3Z5R/kyc',
        kycData
      );

      if (response.data.success) {
        return {
          success: true,
          kycStatus: response.data.kyc_status,
          message: response.data.message,
        };
      } else {
        return {
          success: false,
          kycStatus: 'failed',
          message: response.data.message,
        };
      }
    } catch (error) {
      this.logger.error('Failed to perform KYC:', error);
      return {
        success: false,
        kycStatus: 'failed',
        message: 'Failed to perform KYC verification',
      };
    }
  }

  /**
   * Test the connection to MyPVit API
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test connection by checking balance
      await this.checkBalance();
      return true;
    } catch (error) {
      this.logger.error('MyPVit connection test failed:', error);
      return false;
    }
  }
}
