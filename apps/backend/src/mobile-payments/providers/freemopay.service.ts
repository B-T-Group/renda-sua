import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { FreemopayConfig } from '../../config/configuration';

export interface FreemopayPaymentRequest {
  payer: string;
  amount: number;
  externalId: string;
  description: string;
  callback: string;
}

export interface FreemopayPaymentResponse {
  success: boolean;
  transactionId?: string;
  reference?: string;
  paymentUrl?: string;
  message?: string;
  errorCode?: string;
  status?: string;
}

export interface FreemopayTransactionStatus {
  transactionId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | string;
  amount?: number;
  reference?: string;
  merchantRef?: string;
  reason?: string;
  message?: string;
}

@Injectable()
export class FreemopayService {
  private readonly logger = new Logger(FreemopayService.name);
  private readonly httpClient: AxiosInstance;
  private readonly config: FreemopayConfig;

  constructor(private readonly configService: ConfigService) {
    const freemopayConfig = this.configService.get<FreemopayConfig>('freemopay');

    this.config = {
      baseUrl: freemopayConfig?.baseUrl?.replace(/\/$/, '') || 'https://api-v2.freemopay.com',
      appKey: freemopayConfig?.appKey || '',
      secretKey: freemopayConfig?.secretKey || '',
      callbackUrl: freemopayConfig?.callbackUrl || '',
    };

    this.logger.log('Freemopay configuration loaded');
    this.logger.log(`- Base URL: ${this.config.baseUrl}`);
    this.logger.log(`- App key: ${this.config.appKey ? 'SET' : 'EMPTY'}`);

    const auth =
      this.config.appKey && this.config.secretKey
        ? Buffer.from(
            `${this.config.appKey}:${this.config.secretKey}`,
            'utf-8'
          ).toString('base64')
        : '';

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(auth ? { Authorization: `Basic ${auth}` } : {}),
      },
    });

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `Freemopay API Response: ${response.status}`,
          response.data
        );
        return response;
      },
      (error) => {
        this.logger.error(
          'Freemopay API Error:',
          error.response?.data || error.message
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Initialize a payment transaction (POST /api/v2/payment)
   */
  async initiatePayment(
    paymentRequest: FreemopayPaymentRequest,
    reference?: string
  ): Promise<FreemopayPaymentResponse> {
    try {
      const externalId = reference || paymentRequest.externalId;
      this.logger.log(
        `Initiating Freemopay payment for payer: ${paymentRequest.payer}, externalId: ${externalId}, callback: ${paymentRequest.callback}`
      );

      const payload = {
        payer: paymentRequest.payer,
        amount: paymentRequest.amount,
        externalId,
        description: paymentRequest.description || 'Payment',
        callback: paymentRequest.callback,
      };

      const response = await this.httpClient.post('/api/v2/payment', payload);

      const data = response.data;

      if (response.status === 200 && data?.reference) {
        return {
          success: true,
          transactionId: data.reference,
          reference: data.reference,
          status: data.status,
          message: data.message,
        };
      }

      return {
        success: false,
        message: data?.message || 'Payment initiation failed',
        errorCode: data?.statusCode?.toString() || 'UNKNOWN_ERROR',
        status: data?.status,
      };
    } catch (error: any) {
      this.logger.error('Failed to initiate Freemopay payment:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to initiate payment',
        errorCode:
          error.response?.data?.statusCode?.toString() ||
          error.response?.status?.toString() ||
          'INITIATION_FAILED',
        status: 'FAILED',
      };
    }
  }

  /**
   * Check transaction status (GET /api/v2/payment/:reference)
   */
  async checkTransactionStatus(
    reference: string
  ): Promise<FreemopayTransactionStatus> {
    try {
      this.logger.log(`Checking Freemopay transaction status: ${reference}`);

      const response = await this.httpClient.get(
        `/api/v2/payment/${encodeURIComponent(reference)}`
      );

      const data = response.data;
      const merchantRef = data.merchantRef ?? data.merchandRef;

      return {
        transactionId: data.reference || reference,
        status: data.status || 'PENDING',
        amount: data.amount,
        reference: data.reference,
        merchantRef,
        reason: data.reason,
        message: data.reason || data.message,
      };
    } catch (error: any) {
      this.logger.error(
        'Failed to check Freemopay transaction status:',
        error
      );
      throw error;
    }
  }

  /**
   * Verify payment callback payload (shape validation only; no signature in doc)
   */
  verifyCallback(
    _payload: unknown,
    _signature?: string,
    _timestamp?: string
  ): boolean {
    if (!_payload || typeof _payload !== 'object') return false;
    const p = _payload as Record<string, unknown>;
    return (
      typeof p.reference === 'string' &&
      (typeof p.externalId === 'string' || typeof p.merchantRef === 'string') &&
      typeof p.status === 'string'
    );
  }

  /**
   * Get supported payment methods
   */
  async getSupportedPaymentMethods(): Promise<string[]> {
    return ['mobile_money'];
  }

  /**
   * Cancel a pending transaction (Freemopay API does not document cancel; no-op)
   */
  async cancelTransaction(_reference: string): Promise<boolean> {
    this.logger.warn(
      'Freemopay does not support transaction cancellation via API'
    );
    return false;
  }

  /**
   * Get callback URL from config
   */
  getCallbackUrl(): string {
    return this.config.callbackUrl;
  }

  /**
   * Test connection: checks that credentials and callback URL are configured.
   */
  async testConnection(): Promise<boolean> {
    return !!(
      this.config.appKey &&
      this.config.secretKey &&
      this.config.callbackUrl
    );
  }
}
