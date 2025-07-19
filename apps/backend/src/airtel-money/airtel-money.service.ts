import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AirtelMoneyDatabaseService } from './airtel-money-database.service';

export interface AirtelMoneyConfig {
  clientId: string;
  clientSecret: string;
  targetEnvironment: 'sandbox' | 'production';
  callbackUrl: string;
  country: string;
  currency: string;
}

export interface CollectionRequest {
  reference: string;
  subscriber: {
    country: string;
    currency: string;
    msisdn: string;
  };
  transaction: {
    amount: string;
    country: string;
    currency: string;
    id: string;
  };
}

export interface CollectionResponse {
  status: boolean;
  transactionId?: string;
  reference?: string;
  amount?: string;
  currency?: string;
  statusCode?: string;
  statusMessage?: string;
  error?: string;
}

export interface TransactionStatusResponse {
  status: boolean;
  transactionId?: string;
  reference?: string;
  amount?: string;
  currency?: string;
  statusCode?: string;
  statusMessage?: string;
  error?: string;
}

@Injectable()
export class AirtelMoneyService {
  private readonly config: AirtelMoneyConfig;
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private configService: ConfigService,
    private airtelMoneyDatabaseService: AirtelMoneyDatabaseService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {
    const clientId = this.configService.get<string>('AIRTEL_MONEY_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'AIRTEL_MONEY_CLIENT_SECRET'
    );
    const targetEnvironment = this.configService.get<string>(
      'AIRTEL_MONEY_TARGET_ENVIRONMENT'
    ) as 'sandbox' | 'production';
    const callbackUrl = this.configService.get<string>(
      'AIRTEL_MONEY_CALLBACK_URL'
    );
    const country =
      this.configService.get<string>('AIRTEL_MONEY_COUNTRY') || 'UG';
    const currency =
      this.configService.get<string>('AIRTEL_MONEY_CURRENCY') || 'UGX';

    // Validate required configuration
    if (!clientId || !clientSecret) {
      this.logger.warn(
        'Airtel Money configuration incomplete. Some features may not work properly.'
      );
    }

    this.config = {
      clientId: clientId || '',
      clientSecret: clientSecret || '',
      targetEnvironment: targetEnvironment || 'sandbox',
      callbackUrl: callbackUrl || '',
      country: country,
      currency: currency,
    };

    this.baseUrl =
      this.config.targetEnvironment === 'production'
        ? 'https://openapiuat.airtel.africa'
        : 'https://openapiuat.airtel.africa';

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });

    this.logger.info(
      `Airtel Money service initialized for ${this.config.targetEnvironment} environment`,
      { service: 'AirtelMoneyService' }
    );
  }

  /**
   * Request to pay (Collection) - Request payment from a customer
   */
  async requestToPay(
    request: CollectionRequest,
    userId: string
  ): Promise<CollectionResponse> {
    try {
      const token = await this.getAccessToken();

      const payload = {
        reference: request.reference,
        subscriber: request.subscriber,
        transaction: request.transaction,
      };

      const response = await this.httpClient.post(
        `/merchant/v1/payments/`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Country': this.config.country,
            'X-Currency': this.config.currency,
          },
        }
      );

      await this.logPaymentRequest(
        userId,
        response.data.data.transaction.id,
        request.reference,
        request.transaction.amount,
        request.transaction.currency,
        'PENDING',
        'Payment request initiated'
      );

      return {
        status: true,
        transactionId: response.data.data.transaction.id,
        reference: request.reference,
        amount: request.transaction.amount,
        currency: request.transaction.currency,
        statusMessage: 'Payment request initiated successfully',
      };
    } catch (error: any) {
      this.logger.error('Error in Airtel Money request to pay', {
        error: error.response?.data || error.message,
        service: 'AirtelMoneyService',
      });

      return {
        status: false,
        error: error.response?.data?.message || error.message,
        statusCode: error.response?.status?.toString(),
        statusMessage: 'Payment request failed',
      };
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(
    transactionId: string
  ): Promise<TransactionStatusResponse> {
    try {
      const token = await this.getAccessToken();

      const response = await this.httpClient.get(
        `/standard/v1/payments/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Country': this.config.country,
            'X-Currency': this.config.currency,
          },
        }
      );

      const transaction = response.data.data.transaction;

      return {
        status: true,
        transactionId: transaction.id,
        reference: transaction.reference,
        amount: transaction.amount,
        currency: transaction.currency,
        statusCode: transaction.status,
        statusMessage:
          transaction.status_message || 'Transaction status retrieved',
      };
    } catch (error: any) {
      this.logger.error('Error getting Airtel Money transaction status', {
        error: error.response?.data || error.message,
        service: 'AirtelMoneyService',
      });

      return {
        status: false,
        error: error.response?.data?.message || error.message,
        statusCode: error.response?.status?.toString(),
        statusMessage: 'Failed to get transaction status',
      };
    }
  }

  /**
   * Refund a transaction
   */
  async refundTransaction(
    transactionId: string,
    amount: string,
    reason: string = 'Customer request'
  ): Promise<CollectionResponse> {
    try {
      const token = await this.getAccessToken();

      const payload = {
        transaction: {
          airtel_money_id: transactionId,
        },
        reference: `REFUND_${transactionId}_${Date.now()}`,
      };

      const response = await this.httpClient.post(
        `/standard/v1/payments/refund`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Country': this.config.country,
            'X-Currency': this.config.currency,
          },
        }
      );

      return {
        status: true,
        transactionId: response.data.data.transaction.id,
        reference: payload.reference,
        amount: amount,
        currency: this.config.currency,
        statusMessage: 'Refund initiated successfully',
      };
    } catch (error: any) {
      this.logger.error('Error in Airtel Money refund', {
        error: error.response?.data || error.message,
        service: 'AirtelMoneyService',
      });

      return {
        status: false,
        error: error.response?.data?.message || error.message,
        statusCode: error.response?.status?.toString(),
        statusMessage: 'Refund failed',
      };
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<any> {
    try {
      const token = await this.getAccessToken();

      const response = await this.httpClient.get(
        '/standard/v1/payments/balance',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Country': this.config.country,
            'X-Currency': this.config.currency,
          },
        }
      );

      return {
        status: true,
        data: response.data.data,
      };
    } catch (error: any) {
      this.logger.error('Error getting Airtel Money account balance', {
        error: error.response?.data || error.message,
        service: 'AirtelMoneyService',
      });

      return {
        status: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Get access token for API authentication
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await this.httpClient.post(
        '/auth/oauth2/token',
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'client_credentials',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set token expiry to 50 minutes (tokens typically last 1 hour)
      this.tokenExpiry = Date.now() + 50 * 60 * 1000;

      this.logger.info('Airtel Money access token refreshed', {
        service: 'AirtelMoneyService',
      });

      if (!this.accessToken) {
        throw new Error('Failed to get access token');
      }
      return this.accessToken;
    } catch (error: any) {
      this.logger.error('Error getting Airtel Money access token', {
        error: error.response?.data || error.message,
        service: 'AirtelMoneyService',
      });
      throw new Error('Failed to get access token');
    }
  }

  /**
   * Log payment request to database
   */
  private async logPaymentRequest(
    userId: string,
    transactionId: string,
    reference: string,
    amount: string,
    currency: string,
    status: string,
    message: string,
    notes: string = ''
  ): Promise<void> {
    try {
      await this.airtelMoneyDatabaseService.logPaymentRequest(
        userId,
        transactionId,
        reference,
        amount,
        currency,
        status,
        message,
        notes
      );
    } catch (error: any) {
      this.logger.error('Error logging payment request to database', {
        error: error.message,
        service: 'AirtelMoneyService',
      });
    }
  }

  /**
   * Handle callback from Airtel Money
   */
  async handleCallback(callbackData: any): Promise<void> {
    try {
      this.logger.info('Received Airtel Money callback', {
        data: callbackData,
        service: 'AirtelMoneyService',
      });

      const { transaction, status } = callbackData;

      if (transaction && transaction.id) {
        await this.airtelMoneyDatabaseService.updatePaymentStatus(
          transaction.id,
          status,
          JSON.stringify(callbackData)
        );
      }
    } catch (error: any) {
      this.logger.error('Error handling Airtel Money callback', {
        error: error.message,
        service: 'AirtelMoneyService',
      });
    }
  }
}
