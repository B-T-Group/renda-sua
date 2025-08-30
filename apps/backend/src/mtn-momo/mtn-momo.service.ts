import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { MtnMomoDatabaseService } from './mtn-momo-database.service';

export interface MtnMomoConfig {
  subscriptionKey: string;
  apiKey: string;
  apiUserId: string;
  targetEnvironment: 'sandbox' | 'production';
  collectionPrimaryKey: string;
  collectionSecondaryKey: string;
  disbursementPrimaryKey: string;
  disbursementSecondaryKey: string;
  remittancePrimaryKey: string;
  remittanceSecondaryKey: string;
  callbackUrl: string;
}

export interface CollectionRequest {
  amount: string;
  currency: string;
  externalId: string;
  payer: {
    partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE';
    partyId: string;
  };
  payerMessage: string;
  payeeNote: string;
}

export interface DisbursementRequest {
  amount: string;
  currency: string;
  externalId: string;
  payee: {
    partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE';
    partyId: string;
  };
  payerMessage: string;
  payeeNote: string;
}

export interface RemittanceRequest {
  amount: string;
  currency: string;
  externalId: string;
  payee: {
    partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE';
    partyId: string;
  };
  payerMessage: string;
  payeeNote: string;
}

export interface MtnMomoResponse {
  status: boolean;
  financialTransactionId?: string;
  externalId?: string;
  amount?: string;
  currency?: string;
  payerMessage?: string;
  payeeNote?: string;
  statusCode?: string;
  statusMessage?: string;
  error?: string;
}

@Injectable()
export class MtnMomoService {
  private readonly config: MtnMomoConfig;
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    private mtnMomoDatabaseService: MtnMomoDatabaseService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {
    const subscriptionKey = this.configService.get<string>(
      'MTN_MOMO_SUBSCRIPTION_KEY'
    );
    const apiKey = this.configService.get<string>('MTN_MOMO_API_KEY');
    const apiUserId = this.configService.get<string>('MTN_MOMO_API_USER_ID');
    const targetEnvironment = this.configService.get<string>(
      'MTN_MOMO_TARGET_ENVIRONMENT'
    ) as 'sandbox' | 'production';
    const collectionPrimaryKey = this.configService.get<string>(
      'MTN_MOMO_COLLECTION_PRIMARY_KEY'
    );
    const collectionSecondaryKey = this.configService.get<string>(
      'MTN_MOMO_COLLECTION_SECONDARY_KEY'
    );
    const disbursementPrimaryKey = this.configService.get<string>(
      'MTN_MOMO_DISBURSEMENT_PRIMARY_KEY'
    );
    const disbursementSecondaryKey = this.configService.get<string>(
      'MTN_MOMO_DISBURSEMENT_SECONDARY_KEY'
    );
    const remittancePrimaryKey = this.configService.get<string>(
      'MTN_MOMO_REMITTANCE_PRIMARY_KEY'
    );
    const remittanceSecondaryKey = this.configService.get<string>(
      'MTN_MOMO_REMITTANCE_SECONDARY_KEY'
    );
    const callbackUrl = this.configService.get<string>('MTN_MOMO_CALLBACK_URL');

    // Validate required configuration
    if (!subscriptionKey || !apiKey || !apiUserId) {
      this.logger.warn(
        'MTN MoMo configuration incomplete. Some features may not work properly.'
      );
    }

    this.config = {
      subscriptionKey: subscriptionKey || '',
      apiKey: apiKey || '',
      apiUserId: apiUserId || '',
      targetEnvironment: targetEnvironment || 'sandbox',
      collectionPrimaryKey: collectionPrimaryKey || '',
      collectionSecondaryKey: collectionSecondaryKey || '',
      disbursementPrimaryKey: disbursementPrimaryKey || '',
      disbursementSecondaryKey: disbursementSecondaryKey || '',
      remittancePrimaryKey: remittancePrimaryKey || '',
      remittanceSecondaryKey: remittanceSecondaryKey || '',
      callbackUrl: callbackUrl || '',
    };

    this.baseUrl =
      this.config.targetEnvironment === 'production'
        ? 'https://proxy.momoapi.mtn.com'
        : 'https://sandbox.momodeveloper.mtn.com';

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });

    this.logger.info(
      `MTN MoMo service initialized for ${this.config.targetEnvironment} environment`,
      { service: 'MtnMomoService' }
    );
  }

  /**
   * Request to pay (Collection) - Request payment from a customer
   */
  async requestToPay(
    request: CollectionRequest,
    userId: string
  ): Promise<MtnMomoResponse> {
    try {
      const referenceId = this.generateReferenceId();
      const token = await this.getCollectionToken();

      const payload = {
        amount: request.amount,
        currency: request.currency,
        externalId: request.externalId,
        payer: request.payer,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };

      await this.httpClient.post(`/collection/v1_0/requesttopay`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': this.config.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'Content-Type': 'application/json',
          'X-Callback-Url': this.config.callbackUrl,
        },
      });

      await this.logPaymentRequest(
        userId,
        referenceId,
        request.externalId,
        request.amount,
        request.currency,
        'PENDING',
        request.payerMessage,
        request.payeeNote
      );

      return {
        status: true,
        financialTransactionId: referenceId,
        externalId: request.externalId,
        amount: request.amount,
        currency: request.currency,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };
    } catch (error) {
      this.logger.error(
        `Collection request failed: ${(error as Error).message}`
      );
      return {
        status: false,
        error:
          (error as any)?.response?.data?.message || (error as Error).message,
      };
    }
  }

  /**
   * Request to pay delivery notification - Check payment status
   */
  async requestToPayDeliveryNotification(
    referenceId: string
  ): Promise<MtnMomoResponse> {
    try {
      const token = await this.getCollectionToken();

      const response = await this.httpClient.get(
        `/collection/v1_0/requesttopay/${referenceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Target-Environment': this.config.targetEnvironment,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          },
        }
      );

      const data = response.data;

      return {
        status: data.status === 'SUCCESSFUL',
        financialTransactionId: data.financialTransactionId,
        externalId: data.externalId,
        amount: data.amount,
        currency: data.currency,
        statusCode: data.status,
        statusMessage: data.status,
      };
    } catch (error) {
      this.logger.error(
        `Collection status check failed: ${(error as Error).message}`
      );
      return {
        status: false,
        error:
          (error as any)?.response?.data?.message || (error as Error).message,
      };
    }
  }

  /**
   * Transfer (Disbursement) - Send money to a customer
   */
  async transfer(request: DisbursementRequest): Promise<MtnMomoResponse> {
    try {
      const referenceId = this.generateReferenceId();
      const token = await this.getDisbursementToken();

      const payload = {
        amount: request.amount,
        currency: request.currency,
        externalId: request.externalId,
        payee: request.payee,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };

      await this.httpClient.post(`/disbursement/v1_0/transfer`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': this.config.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'Content-Type': 'application/json',
        },
      });

      this.logger.info(`Disbursement initiated: ${referenceId}`);

      return {
        status: true,
        financialTransactionId: referenceId,
        externalId: request.externalId,
        amount: request.amount,
        currency: request.currency,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };
    } catch (error) {
      this.logger.error(`Disbursement failed: ${(error as Error).message}`);
      return {
        status: false,
        error:
          (error as any)?.response?.data?.message || (error as Error).message,
      };
    }
  }

  /**
   * Transfer delivery notification - Check transfer status
   */
  async transferDeliveryNotification(
    referenceId: string
  ): Promise<MtnMomoResponse> {
    try {
      const token = await this.getDisbursementToken();

      const response = await this.httpClient.get(
        `/disbursement/v1_0/transfer/${referenceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Target-Environment': this.config.targetEnvironment,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          },
        }
      );

      const data = response.data;

      return {
        status: data.status === 'SUCCESSFUL',
        financialTransactionId: data.financialTransactionId,
        externalId: data.externalId,
        amount: data.amount,
        currency: data.currency,
        statusCode: data.status,
        statusMessage: data.status,
      };
    } catch (error) {
      this.logger.error(
        `Disbursement status check failed: ${(error as Error).message}`
      );
      return {
        status: false,
        error:
          (error as any)?.response?.data?.message || (error as Error).message,
      };
    }
  }

  /**
   * Remittance - Send money internationally
   */
  async remittance(request: RemittanceRequest): Promise<MtnMomoResponse> {
    try {
      const referenceId = this.generateReferenceId();
      const token = await this.getRemittanceToken();

      const payload = {
        amount: request.amount,
        currency: request.currency,
        externalId: request.externalId,
        payee: request.payee,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };

      await this.httpClient.post(`/remittance/v1_0/transfer`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': this.config.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'Content-Type': 'application/json',
        },
      });

      this.logger.info(`Remittance initiated: ${referenceId}`);

      return {
        status: true,
        financialTransactionId: referenceId,
        externalId: request.externalId,
        amount: request.amount,
        currency: request.currency,
        payerMessage: request.payerMessage,
        payeeNote: request.payeeNote,
      };
    } catch (error) {
      this.logger.error(`Remittance failed: ${(error as Error).message}`);
      return {
        status: false,
        error:
          (error as any)?.response?.data?.message || (error as Error).message,
      };
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(
    type: 'collection' | 'disbursement' | 'remittance' = 'collection'
  ): Promise<any> {
    try {
      const token = await this.getToken(type);

      const response = await this.httpClient.get(
        `/${type}/v1_0/account/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Target-Environment': this.config.targetEnvironment,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          },
        }
      );

      return {
        status: true,
        balance: response.data.availableBalance,
        currency: response.data.currency,
      };
    } catch (error) {
      this.logger.error(`Balance check failed: ${(error as Error).message}`);
      return {
        status: false,
        error:
          (error as any)?.response?.data?.message || (error as Error).message,
      };
    }
  }

  /**
   * Validate account holder
   */
  async validateAccountHolder(
    partyId: string,
    partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE',
    type: 'collection' | 'disbursement' | 'remittance' = 'collection'
  ): Promise<any> {
    try {
      const token = await this.getToken(type);

      const response = await this.httpClient.get(
        `/${type}/v1_0/accountholder/${partyIdType}/${partyId}/active`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Target-Environment': this.config.targetEnvironment,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          },
        }
      );

      return {
        status: true,
        result: response.data.result,
        message: response.data.message,
      };
    } catch (error) {
      this.logger.error(
        `Account validation failed: ${(error as Error).message}`
      );
      return {
        status: false,
        error:
          (error as any)?.response?.data?.message || (error as Error).message,
      };
    }
  }

  /**
   * Get collection token
   */
  private async getCollectionToken(): Promise<string> {
    return this.getToken('collection');
  }

  /**
   * Get disbursement token
   */
  private async getDisbursementToken(): Promise<string> {
    return this.getToken('disbursement');
  }

  /**
   * Get remittance token
   */
  private async getRemittanceToken(): Promise<string> {
    return this.getToken('remittance');
  }

  /**
   * Get access token for the specified type
   */
  private async getToken(
    type: 'collection' | 'disbursement' | 'remittance'
  ): Promise<string> {
    try {
      const apiKey = this.config.apiKey;

      console.log('apiKey', apiKey);
      console.log('this.config.apiUserId', this.config.apiUserId);
      console.log('this.config.subscriptionKey', this.config.subscriptionKey);

      const response = await this.httpClient.post(
        `/${type}/token/`,
        {},
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${this.config.apiUserId}:${apiKey}`
            ).toString('base64')}`,
            'X-Reference-Id': this.generateReferenceId(),
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      this.logger.error(
        `Token generation failed for ${type}: ${(error as Error).message}`
      );
      throw new Error(
        `Failed to get ${type} token: ${(error as Error).message}`
      );
    }
  }

  /**
   * Generate a unique reference ID
   */
  private generateReferenceId(): string {
    return randomUUID();
  }

  /**
   * Log payment request to database
   */
  private async logPaymentRequest(
    userId: string,
    transactionId: string,
    externalId: string,
    amount: string,
    currency: string,
    status: string,
    payerMessage: string,
    payeeNote: string
  ): Promise<void> {
    try {
      await this.mtnMomoDatabaseService.logPaymentRequest({
        userId,
        transactionId,
        externalId,
        amount: parseFloat(amount),
        currency,
        status,
        payerMessage,
        payeeNote,
      });
    } catch (error) {
      this.logger.error(
        `Failed to log payment request: ${(error as Error).message}`
      );
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Handle webhook callbacks from MTN MoMo
   */
  async handleCallback(callbackData: any): Promise<void> {
    try {
      this.logger.info(
        `Received MTN MoMo callback: ${JSON.stringify(callbackData)}`
      );

      // Process the callback data based on the notification type
      const { financialTransactionId, status } = callbackData;

      // Here you would typically:
      // 1. Update your database with the transaction status
      // 2. Send notifications to your users
      // 3. Update order status if this is a payment for an order
      // 4. Log the transaction for audit purposes

      this.logger.info(
        `Processed callback for transaction: ${financialTransactionId}, status: ${status}`
      );
    } catch (error) {
      this.logger.error(
        `Callback processing failed: ${(error as Error).message}`
      );
      throw error;
    }
  }
}
