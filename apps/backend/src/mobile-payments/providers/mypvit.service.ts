import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { MyPVitConfig } from '../../config/configuration';

export interface MyPVitPaymentRequest {
  amount: number;
  service: string;
  callback_url_code: string;
  customer_account_number: string;
  merchant_operation_account_code: string;
  transaction_type: string;
  owner_charge: string;
  free_info?: string;
}

export interface MyPVitPaymentResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  message?: string;
  errorCode?: string;
  status?: string;
  status_code?: string;
  operator?: string;
  reference_id?: string;
  merchant_reference_id?: string;
  merchant_operation_account_code?: string;
}

export interface MyPVitTransactionStatus {
  transactionId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | string;
  status_code?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  reference_id?: string;
  merchant_reference_id?: string;
  operator?: string;
  merchant_operation_account_code?: string;
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
      callbackUrlCode:
        this.configService.get<string>('MYPVIT_CALLBACK_URL_CODE') || 'FJXSU',
      merchantOperationAccountCode:
        this.configService.get<string>(
          'MYPVIT_MERCHANT_OPERATION_ACCOUNT_CODE'
        ) || 'ACC_68A722C33473B',
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

      config.headers['Content-Type'] = 'application/json';
      config.headers['X-Secret'] = secretKey;
      config.headers['X-Callback-MediaType'] = 'application/json';

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
   * Initialize a payment transaction using REST API
   */
  async initiatePayment(
    paymentRequest: MyPVitPaymentRequest,
    reference?: string
  ): Promise<MyPVitPaymentResponse> {
    try {
      // Generate a unique reference (max 15 characters) if not provided
      if (!reference) {
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.random().toString(36).substr(2, 4);
        reference = `P${timestamp}${random}`;
      }

      this.logger.log(
        `Initiating payment for account: ${paymentRequest.customer_account_number}`
      );

      const payload = {
        amount: paymentRequest.amount,
        reference: reference,
        service: paymentRequest.service,
        callback_url_code: paymentRequest.callback_url_code,
        customer_account_number: '0' + paymentRequest.customer_account_number,
        merchant_operation_account_code:
          paymentRequest.merchant_operation_account_code,
        transaction_type: paymentRequest.transaction_type,
        owner_charge: paymentRequest.owner_charge,
        free_info: paymentRequest.free_info,
      };

      // Use the REST endpoint for payment initiation
      const response = await this.httpClient.post(
        '/X5T3RIBYQUDFBZSH/rest',
        payload
      );

      console.log('response.data', response.data);

      // Check if the response indicates success based on status_code
      if (response.data.status_code === '200') {
        return {
          success: true,
          transactionId: response.data.reference_id,
          status: response.data.status,
          status_code: response.data.status_code,
          operator: response.data.operator,
          reference_id: response.data.reference_id,
          merchant_reference_id: response.data.merchant_reference_id,
          merchant_operation_account_code:
            response.data.merchant_operation_account_code,
          message: response.data.message,
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Payment initiation failed',
          errorCode: response.data.status_code || 'UNKNOWN_ERROR',
          status: response.data.status,
          status_code: response.data.status_code,
        };
      }
    } catch (error) {
      this.logger.error('Failed to initiate payment:', error);
      return {
        success: false,
        message: 'Failed to initiate payment',
        errorCode: 'INITIATION_FAILED',
        status: 'FAILED',
        status_code: '500',
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

      // Check if the response indicates success based on status_code
      if (response.data.status_code === '200') {
        return {
          transactionId:
            response.data.reference_id || response.data.transaction_id,
          status: response.data.status,
          status_code: response.data.status_code,
          amount: response.data.amount,
          currency: response.data.currency,
          reference: response.data.reference,
          reference_id: response.data.reference_id,
          merchant_reference_id: response.data.merchant_reference_id,
          operator: response.data.operator,
          merchant_operation_account_code:
            response.data.merchant_operation_account_code,
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
    // Signature verification disabled - always return true
    return true;
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

  /**
   * Get callback URL code
   */
  getCallbackUrlCode(): string {
    return this.config.callbackUrlCode;
  }

  /**
   * Get merchant operation account code
   */
  getMerchantOperationAccountCode(): string {
    return this.config.merchantOperationAccountCode;
  }
}
