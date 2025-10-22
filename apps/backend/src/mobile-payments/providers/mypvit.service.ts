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

  constructor(private readonly configService: ConfigService) {
    // Get the MyPVit configuration from the configuration service
    const mypvitConfig = this.configService.get<MyPVitConfig>('mypvit');
    
    this.config = {
      baseUrl: mypvitConfig?.baseUrl || 'https://api.mypvit.pro',
      merchantSlug: mypvitConfig?.merchantSlug || 'MR_1755783875',
      airtelSecretKey: mypvitConfig?.airtelSecretKey || '', // Loaded from AWS Secrets Manager
      moovSecretKey: mypvitConfig?.moovSecretKey || '', // Loaded from AWS Secrets Manager
      environment: mypvitConfig?.environment || 'test',
      callbackUrlCode: mypvitConfig?.callbackUrlCode || 'FJXSU',
      secretRefreshUrlCode: mypvitConfig?.secretRefreshUrlCode || 'TRUVU',
      airtelMerchantOperationAccountCode: mypvitConfig?.airtelMerchantOperationAccountCode || 'ACC_68A722C33473B',
      moovMerchantOperationAccountCode: mypvitConfig?.moovMerchantOperationAccountCode || 'ACC_68F90896204C1',
      paymentEndpointCode: mypvitConfig?.paymentEndpointCode || 'X5T3RIBYQUDFBZSH',
    };

    // Log secret key status for debugging
    this.logger.log(`MyPVit configuration loaded:`);
    this.logger.log(`- Airtel secret key: ${this.config.airtelSecretKey ? 'LOADED' : 'EMPTY'}`);
    this.logger.log(`- MOOV secret key: ${this.config.moovSecretKey ? 'LOADED' : 'EMPTY'}`);
    this.logger.log(`- Airtel account code: ${this.config.airtelMerchantOperationAccountCode}`);
    this.logger.log(`- MOOV account code: ${this.config.moovMerchantOperationAccountCode}`);

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Note: Secret key will be set per request based on phone number context

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
   * Initialize a payment transaction using REST API
   */
  async initiatePayment(
    paymentRequest: MyPVitPaymentRequest,
    reference?: string,
    phoneNumber?: string
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

      // Get the appropriate secret key based on phone number
      const secretKey = phoneNumber
        ? this.getSecretKeyForProvider(phoneNumber)
        : this.config.airtelSecretKey;

      this.logger.log(`Using secret key for payment: ${secretKey ? 'PRESENT' : 'EMPTY'} (length: ${secretKey?.length || 0})`);

      // Use the REST endpoint for payment initiation
      const response = await this.httpClient.post(
        `/${this.config.paymentEndpointCode}/rest`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Secret': secretKey,
            'X-Callback-MediaType': 'application/json',
          },
        }
      );

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
    } catch (error: unknown) {
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
    transactionId: string,
    phoneNumber?: string
  ): Promise<MyPVitTransactionStatus> {
    try {
      this.logger.log(`Checking transaction status for: ${transactionId}`);

      // Get the appropriate secret key based on phone number
      const secretKey = phoneNumber
        ? this.getSecretKeyForProvider(phoneNumber)
        : this.config.airtelSecretKey;

      const response = await this.httpClient.get(
        `/RYXA6SLFNRBFFQJX/status/${transactionId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Secret': secretKey,
            'X-Callback-MediaType': 'application/json',
          },
        }
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
    _payload: unknown,
    _signature: string,
    _timestamp: string
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
  async cancelTransaction(
    transactionId: string,
    phoneNumber?: string
  ): Promise<boolean> {
    try {
      this.logger.log(`Cancelling transaction: ${transactionId}`);

      // Get the appropriate secret key based on phone number
      const secretKey = phoneNumber
        ? this.getSecretKeyForProvider(phoneNumber)
        : this.config.airtelSecretKey;

      const response = await this.httpClient.post(
        `/RYXA6SLFNRBFFQJX/status/${transactionId}/cancel`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Secret': secretKey,
            'X-Callback-MediaType': 'application/json',
          },
        }
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
  }): Promise<unknown[]> {
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
  async checkBalance(
    phoneNumber?: string
  ): Promise<{ balance: number; currency: string }> {
    try {
      this.logger.log('Checking merchant balance');

      // Get the appropriate secret key based on phone number
      const secretKey = phoneNumber
        ? this.getSecretKeyForProvider(phoneNumber)
        : this.config.airtelSecretKey;

      const response = await this.httpClient.get('/LIRYOTW7QL3DCDPJ/balance', {
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': secretKey,
          'X-Callback-MediaType': 'application/json',
        },
      });

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
   * Get merchant operation account code based on phone number
   * @param phoneNumber - Phone number without country code
   * @returns Account code for Airtel or MOOV
   */
  getMerchantOperationAccountCode(phoneNumber: string): string {
    if (!phoneNumber) {
      return this.config.airtelMerchantOperationAccountCode;
    }

    // Remove any leading zeros or country code remnants
    const cleanNumber = phoneNumber.replace(/^0+/, '');

    // Extract first 2-3 digits
    const prefix = cleanNumber.substring(0, 3);
    const prefixTwo = cleanNumber.substring(0, 2);

    // MOOV prefixes: 062, 065, 066 (or 62, 65, 66)
    if (
      prefix === '062' ||
      prefix === '065' ||
      prefix === '066' ||
      prefixTwo === '62' ||
      prefixTwo === '65' ||
      prefixTwo === '66'
    ) {
      return this.config.moovMerchantOperationAccountCode;
    }

    // Airtel prefixes: 074, 077 (or 74, 77)
    if (
      prefix === '074' ||
      prefix === '077' ||
      prefixTwo === '74' ||
      prefixTwo === '77'
    ) {
      return this.config.airtelMerchantOperationAccountCode;
    }

    // Default to Airtel account
    return this.config.airtelMerchantOperationAccountCode;
  }

  /**
   * Get secret key based on phone number provider
   * @param phoneNumber - Phone number without country code
   * @returns Secret key for Airtel or MOOV
   */
  getSecretKeyForProvider(phoneNumber: string): string {
    if (!phoneNumber) {
      this.logger.log('No phone number provided, using Airtel secret key');
      return this.config.airtelSecretKey;
    }

    const cleanNumber = phoneNumber.replace(/^0+/, '');
    const prefix = cleanNumber.substring(0, 3);
    const prefixTwo = cleanNumber.substring(0, 2);

    this.logger.log(`Phone number analysis: ${phoneNumber} -> ${cleanNumber} (prefix: ${prefix}, prefixTwo: ${prefixTwo})`);

    // MOOV prefixes
    if (
      prefix === '062' ||
      prefix === '065' ||
      prefix === '066' ||
      prefixTwo === '62' ||
      prefixTwo === '65' ||
      prefixTwo === '66'
    ) {
      this.logger.log('Detected MOOV provider, using MOOV secret key');
      return this.config.moovSecretKey;
    }

    // Airtel or default
    this.logger.log('Detected Airtel provider (or default), using Airtel secret key');
    return this.config.airtelSecretKey;
  }
}
