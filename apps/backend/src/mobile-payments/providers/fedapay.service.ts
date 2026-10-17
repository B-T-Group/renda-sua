import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { randomUUID } from 'crypto';
import {
  FedaPay,
  Transaction,
  Payout,
} from 'fedapay';
import type { FedaPayConfig } from '../../config/configuration';
import { normalizeProviderMessage } from '../normalize-provider-message';
import type { MobilePaymentCallbackProcessor } from '../mobile-payment-callback.processor';
import type { FedaPayCallbackDto } from '../mobile-payment-callback.dto';

export interface FedaPayPaymentRequest {
  payer: string;
  amount: number;
  externalId: string;
  description: string;
  callback: string;
  /** Channel code: moov_tg or togocel (Mixx by Yas). */
  channel: 'moov_tg' | 'togocel';
}

export interface FedaPayWithdrawalRequest {
  payee: string;
  amount: number;
  externalId: string;
  description: string;
  callback: string;
  /** Channel code: moov_tg or togocel (Mixx by Yas). Only Mixx documented for payouts. */
  channel: 'moov_tg' | 'togocel';
}

export interface FedaPayPaymentResponse {
  success: boolean;
  transactionId?: string;
  reference?: string;
  token?: string;
  paymentUrl?: string;
  message?: string;
  errorCode?: string;
  status?: string;
}

export interface FedaPayWithdrawalResponse {
  success: boolean;
  transactionId?: string;
  reference?: string;
  message?: string;
  errorCode?: string;
  status?: string;
}

export interface FedaPayTransactionStatus {
  transactionId: string;
  status: 'pending' | 'approved' | 'declined' | 'canceled' | 'transferred' | string;
  amount?: number;
  currency?: string;
  reference?: string;
  merchantRef?: string;
  reason?: string;
  message?: string;
}

@Injectable()
export class FedaPayService implements OnModuleInit {
  private readonly logger = new Logger(FedaPayService.name);
  private readonly config: FedaPayConfig;
  private readonly mockEnabled: boolean;
  private readonly mockThreshold = 1_000_000;
  private readonly mockCallbackDelayMs = 1500;
  private readonly mockOutcomes = new Map<
    string,
    { outcome: 'approved' | 'declined' | 'pending'; amount: number }
  >();
  private readonly mockPendingPhones: string[];
  private callbackProcessor: MobilePaymentCallbackProcessor | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef
  ) {
    const fedapayConfig = this.configService.get<FedaPayConfig>('fedapay');

    this.config = {
      environment: fedapayConfig?.environment ?? 'sandbox',
      secretKey: fedapayConfig?.secretKey || '',
      publicKey: fedapayConfig?.publicKey || '',
      webhookSecret: fedapayConfig?.webhookSecret || '',
      callbackUrl: fedapayConfig?.callbackUrl || '',
      payoutCallbackUrl: fedapayConfig?.payoutCallbackUrl || '',
      mockEnabled: fedapayConfig?.mockEnabled ?? false,
      mockPendingPhones: fedapayConfig?.mockPendingPhones ?? [],
    };

    const deploymentEnv = process.env.DEPLOYMENT_ENV?.toLowerCase();
    
    if (this.config.mockEnabled) {
      if (!deploymentEnv || !['development', 'test'].includes(deploymentEnv)) {
        throw new Error(
          `FedaPay mock can only be enabled when DEPLOYMENT_ENV is 'development' or 'test', got: ${deploymentEnv || '(unset)'}`
        );
      }
      if (this.config.secretKey?.startsWith('sk_live_')) {
        throw new Error(
          'FedaPay mock cannot be enabled with a live secret key (sk_live_*)'
        );
      }
    }
    
    this.mockEnabled = this.config.mockEnabled;
    this.mockPendingPhones = this.mockEnabled ? this.config.mockPendingPhones : [];

    this.logger.log('FedaPay configuration loaded');
    this.logger.log(`- Environment: ${this.config.environment}`);
    this.logger.log(`- Secret key: ${this.config.secretKey ? 'SET' : 'EMPTY'}`);
    if (this.mockEnabled) {
      this.logger.warn(
        `⚠️  FedaPay DEV MOCK ENABLED: amounts < ${this.mockThreshold} XOF will simulate approved, >= ${this.mockThreshold} XOF will simulate declined. NO LIVE API CALLS.`
      );
    }

    if (this.config.secretKey) {
      FedaPay.setApiKey(this.config.secretKey);
      FedaPay.setEnvironment(this.config.environment);
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      this.callbackProcessor = this.moduleRef.get('MobilePaymentCallbackProcessor', {
        strict: false,
      });
      if (this.callbackProcessor && this.mockEnabled) {
        this.logger.log(
          '✅ Callback processor resolved for mock auto-callbacks'
        );
      }
    } catch (error) {
      this.callbackProcessor = null;
      if (this.mockEnabled) {
        this.logger.warn(
          'Callback processor not available - auto-callbacks will be skipped'
        );
      }
    }
  }

  private isMockedTransaction(reference: string): boolean {
    return reference?.startsWith('mock-') ?? false;
  }

  private generateMockReference(): string {
    return `mock-${randomUUID()}`;
  }

  private getMockOutcome(amount: number): 'approved' | 'declined' {
    return amount < this.mockThreshold ? 'approved' : 'declined';
  }

  private isValidTogoPhone(phone: string | undefined | null): boolean {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, '');
    // Must start with 228 or be exactly 8 digits (national format)
    if (cleaned.startsWith('228')) {
      const national = cleaned.slice(3);
      if (national.length !== 8) return false;
      const prefix = national.slice(0, 2);
      // Moov: 78, 79, 96, 97, 98, 99
      // Mixx: 70, 71, 72, 73, 90, 91, 92, 93
      return ['70', '71', '72', '73', '78', '79', '90', '91', '92', '93', '96', '97', '98', '99'].includes(prefix);
    }
    // National format
    if (cleaned.length === 8) {
      const prefix = cleaned.slice(0, 2);
      return ['70', '71', '72', '73', '78', '79', '90', '91', '92', '93', '96', '97', '98', '99'].includes(prefix);
    }
    return false;
  }

  private validatePaymentRequest(request: FedaPayPaymentRequest): { valid: boolean; error?: string } {
    if (!this.isValidTogoPhone(request.payer)) {
      return { valid: false, error: 'Invalid Togo phone number. Must be +228 followed by valid Moov or Mixx prefix.' };
    }
    return { valid: true };
  }

  private validateWithdrawalRequest(request: FedaPayWithdrawalRequest): { valid: boolean; error?: string } {
    if (!this.isValidTogoPhone(request.payee)) {
      return { valid: false, error: 'Invalid Togo phone number. Must be +228 followed by valid Moov or Mixx prefix.' };
    }
    return { valid: true };
  }

  private scheduleAutoCallback(
    mockReference: string,
    externalId: string,
    outcome: 'approved' | 'declined'
  ): void {
    if (!this.callbackProcessor) {
      this.logger.warn(
        `Cannot schedule auto-callback for ${mockReference}: callback processor not available`
      );
      return;
    }

    setTimeout(async () => {
      try {
        const callbackData: FedaPayCallbackDto = {
          entity: {
            id: parseInt(mockReference.replace('mock-', '').split('-')[0], 36),
            status: outcome,
            amount: 0,
            reference: mockReference,
            custom_metadata: { externalId },
          },
          name: outcome === 'approved' ? 'transaction.approved' : 'transaction.declined',
        };

        this.logger.log(
          `🔨 AUTO-CALLBACK triggered for ${mockReference}: ${outcome} (delay=${this.mockCallbackDelayMs}ms)`
        );

        await this.callbackProcessor!.processFedaPayCallback(callbackData);
      } catch (error: any) {
        this.logger.error(
          `Failed to process auto-callback for ${mockReference}: ${
            error?.message || error
          }`
        );
      }
    }, this.mockCallbackDelayMs);
  }

  private isMockPendingPayer(payer?: string): boolean {
    const digits = String(payer || '').replace(/\D/g, '');
    if (!digits) return false;
    return this.mockPendingPhones.some(
      (p) => digits === p || digits.slice(-8) === p.slice(-8)
    );
  }

  private mockInitiatePayment(
    paymentRequest: FedaPayPaymentRequest,
    reference?: string
  ): FedaPayPaymentResponse {
    const externalId = reference || paymentRequest.externalId;
    const mockRef = this.generateMockReference();
    
    if (this.isMockPendingPayer(paymentRequest.payer)) {
      this.mockOutcomes.set(mockRef, { outcome: 'pending', amount: paymentRequest.amount });
      this.logger.log(
        `🔨 MOCK FedaPay payment: payer=${paymentRequest.payer} is on FEDAPAY_MOCK_PENDING_PHONES, reference=${externalId}, mock_ref=${mockRef}: stays pending (no auto-callback)`
      );
      return {
        success: true,
        transactionId: mockRef,
        reference: mockRef,
        status: 'pending',
        message: normalizeProviderMessage(null, 'Mock payment initiated (stuck pending)'),
      };
    }
    
    const outcome = this.getMockOutcome(paymentRequest.amount);
    this.mockOutcomes.set(mockRef, { outcome, amount: paymentRequest.amount });

    this.logger.log(
      `🔨 MOCK FedaPay payment: amount=${paymentRequest.amount} XOF, payer=${paymentRequest.payer}, channel=${paymentRequest.channel}, reference=${externalId}, mock_ref=${mockRef}, outcome=${outcome} (auto-callback in ${this.mockCallbackDelayMs}ms)`
    );

    this.scheduleAutoCallback(mockRef, externalId, outcome);

    return {
      success: true,
      transactionId: mockRef,
      reference: mockRef,
      status: 'pending',
      message: normalizeProviderMessage(null, 'Mock payment initiated'),
    };
  }

  private mockWithdraw(
    withdrawalRequest: FedaPayWithdrawalRequest,
    reference?: string
  ): FedaPayWithdrawalResponse {
    const externalId = reference || withdrawalRequest.externalId;
    const mockRef = this.generateMockReference();
    const outcome = this.getMockOutcome(withdrawalRequest.amount);

    this.mockOutcomes.set(mockRef, { outcome, amount: withdrawalRequest.amount });

    this.logger.log(
      `🔨 MOCK FedaPay payout: amount=${withdrawalRequest.amount} XOF, payee=${withdrawalRequest.payee}, channel=${withdrawalRequest.channel}, reference=${externalId}, mock_ref=${mockRef}, outcome=${outcome} (auto-callback in ${this.mockCallbackDelayMs}ms)`
    );

    this.scheduleAutoCallback(mockRef, externalId, outcome);

    return {
      success: true,
      transactionId: mockRef,
      reference: mockRef,
      status: 'pending',
      message: normalizeProviderMessage(null, 'Mock payout initiated'),
    };
  }

  async initiatePayment(
    paymentRequest: FedaPayPaymentRequest,
    reference?: string
  ): Promise<FedaPayPaymentResponse> {
    // Validate request
    const validation = this.validatePaymentRequest(paymentRequest);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error!,
        errorCode: 'VALIDATION_ERROR',
        status: 'failed',
      };
    }

    if (this.mockEnabled) {
      return this.mockInitiatePayment(paymentRequest, reference);
    }

    try {
      const externalId = reference || paymentRequest.externalId;
      this.logger.log(
        `Initiating FedaPay payment: channel=${paymentRequest.channel}, externalId=${externalId}`
      );

      const transaction = await Transaction.create({
        description: paymentRequest.description || 'Payment',
        amount: paymentRequest.amount,
        currency: { iso: 'XOF' },
        callback_url: paymentRequest.callback,
        mode: paymentRequest.channel,
        custom_metadata: {
          externalId,
        },
        customer: {
          phone_number: {
            number: paymentRequest.payer,
            country: 'TG',
          },
        },
      });

      if (transaction && transaction.id) {
        const txData: any = transaction;
        const tokenResponse = await txData.generateToken();
        const token = tokenResponse?.token || tokenResponse;
        
        await txData.sendNowWithToken(paymentRequest.channel, token, {
          phone_number: {
            number: paymentRequest.payer,
            country: 'TG',
          },
        });
        
        return {
          success: true,
          transactionId: String(transaction.id),
          reference: String(transaction.id),
          token,
          status: txData.status || 'pending',
          message: normalizeProviderMessage(null, 'Payment initiated'),
        };
      }

      return {
        success: false,
        message: normalizeProviderMessage(null, 'Payment initiation failed'),
        errorCode: 'INITIATION_FAILED',
        status: 'failed',
      };
    } catch (error: any) {
      this.logger.error(`Failed to initiate FedaPay payment: ${error.message}`);
      return {
        success: false,
        message: normalizeProviderMessage(
          error.message,
          'Failed to initiate payment'
        ),
        errorCode: error.code || 'INITIATION_FAILED',
        status: 'failed',
      };
    }
  }

  async withdraw(
    withdrawalRequest: FedaPayWithdrawalRequest,
    reference?: string
  ): Promise<FedaPayWithdrawalResponse> {
    // Validate request
    const validation = this.validateWithdrawalRequest(withdrawalRequest);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error!,
        errorCode: 'VALIDATION_ERROR',
        status: 'failed',
      };
    }

    if (this.mockEnabled) {
      return this.mockWithdraw(withdrawalRequest, reference);
    }

    try {
      const externalId = reference || withdrawalRequest.externalId;
      this.logger.log(
        `Initiating FedaPay payout: channel=${withdrawalRequest.channel}, externalId=${externalId}`
      );

      // Check for existing payout with same externalId (B6 idempotency)
      try {
        const existingPayouts = await (Payout as any).list({
          'custom_metadata.externalId': externalId,
        });
        if (existingPayouts?.data?.length > 0) {
          const existing = existingPayouts.data[0];
          this.logger.log(`Found existing FedaPay payout for ${externalId}: ${existing.id}`);
          return {
            success: true,
            transactionId: String(existing.id),
            reference: externalId,
            status: existing.status || 'pending',
            message: normalizeProviderMessage(null, 'Payout already exists'),
          };
        }
      } catch (lookupError: any) {
        this.logger.warn(`Failed to check existing payout: ${lookupError.message}`);
      }

      const payout = await Payout.create({
        amount: withdrawalRequest.amount,
        currency: { iso: 'XOF' },
        mode: withdrawalRequest.channel,
        description: withdrawalRequest.description || 'Payout',
        customer: {
          phone_number: {
            number: withdrawalRequest.payee,
            country: 'TG',
          },
        },
        custom_metadata: {
          externalId,
        },
      });

      if (payout && payout.id) {
        const payoutData: any = payout;
        await payoutData.sendNow();
        
        return {
          success: true,
          transactionId: String(payout.id),
          reference: externalId,
          status: payoutData.status || 'pending',
          message: normalizeProviderMessage(null, 'Payout initiated'),
        };
      }

      return {
        success: false,
        message: normalizeProviderMessage(null, 'Payout initiation failed'),
        errorCode: 'INITIATION_FAILED',
        status: 'failed',
      };
    } catch (error: any) {
      this.logger.error(`Failed to initiate FedaPay payout: ${error.message}`);
      return {
        success: false,
        message: normalizeProviderMessage(
          error.message,
          'Failed to initiate payout'
        ),
        errorCode: error.code || 'WITHDRAWAL_FAILED',
        status: 'failed',
      };
    }
  }

  async checkPayoutStatus(
    payoutId: string
  ): Promise<FedaPayTransactionStatus> {
    if (this.mockEnabled && this.isMockedTransaction(payoutId)) {
      return this.getMockTransactionStatus(payoutId);
    }

    try {
      this.logger.log(`Checking FedaPay payout status: ${payoutId}`);

      const payout = await Payout.retrieve(parseInt(payoutId, 10));

      if (!payout) {
        throw new Error(`Payout ${payoutId} not found`);
      }

      const payoutData: any = payout;
      const customMeta = payoutData.custom_metadata || {};
      const currency = payoutData.currency?.iso || 'XOF';

      const statusMap: Record<string, string> = {
        sent: 'approved',
        failed: 'declined',
        pending: 'pending',
      };

      const mappedStatus = statusMap[payoutData.status] || payoutData.status;

      return {
        transactionId: String(payout.id),
        status: mappedStatus,
        amount: payoutData.amount,
        currency,
        reference: String(payout.id),
        merchantRef: customMeta.externalId || '',
        reason: payoutData.reason || '',
        message: normalizeProviderMessage(
          payoutData.reason || payoutData.message,
          'Payout status check completed'
        ),
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to check FedaPay payout status: ${error.message}`
      );
      throw error;
    }
  }

  async checkTransactionStatus(
    reference: string
  ): Promise<FedaPayTransactionStatus> {
    if (this.mockEnabled && this.isMockedTransaction(reference)) {
      return this.getMockTransactionStatus(reference);
    }

    try {
      this.logger.log(`Checking FedaPay transaction status: ${reference}`);

      const transaction = await Transaction.retrieve(parseInt(reference, 10));

      if (!transaction) {
        throw new Error(`Transaction ${reference} not found`);
      }

      const txData: any = transaction;
      const customMeta = txData.custom_metadata || {};
      const currency = txData.currency?.iso || 'XOF';

      return {
        transactionId: String(transaction.id),
        status: txData.status || 'pending',
        amount: txData.amount,
        currency,
        reference: String(transaction.id),
        merchantRef: customMeta.externalId || '',
        reason: txData.reason || '',
        message: normalizeProviderMessage(
          txData.reason || txData.message,
          'Status check completed'
        ),
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to check FedaPay transaction status: ${error.message || 'Unknown error'}`
      );
      throw error;
    }
  }

  private getMockTransactionStatus(reference: string): FedaPayTransactionStatus {
    const stored = this.mockOutcomes.get(reference);
    
    if (!stored) {
      this.logger.warn(`🔨 MOCK FedaPay status check: ${reference} (not found in mock outcomes, returning pending)`);
      return {
        transactionId: reference,
        status: 'pending',
        amount: 0,
        reference,
        merchantRef: '',
        message: 'Mock transaction not found',
      };
    }

    const status = stored.outcome;
    this.logger.log(`🔨 MOCK FedaPay status check: ${reference}, amount=${stored.amount} XOF, outcome=${status}`);
    
    return {
      transactionId: reference,
      status,
      amount: stored.amount,
      reference,
      merchantRef: '',
      reason: status === 'declined' ? 'Mock failure (amount >= threshold)' : undefined,
      message: status === 'approved' 
        ? 'Mock transaction approved' 
        : 'Mock transaction declined (amount >= threshold)',
    };
  }

  verifyWebhookSignature(
    payload: string | Buffer,
    signatureHeader: string,
    webhookSecret?: string
  ): boolean {
    try {
      const secret = webhookSecret || this.config.webhookSecret;
      if (!secret) {
        this.logger.warn('Webhook secret not configured, skipping signature verification');
        return false;
      }

      const payloadString = typeof payload === 'string' ? payload : payload.toString();
      
      // Parse header: t=timestamp,v1=signature
      const parts = signatureHeader.split(',');
      let timestamp: string | null = null;
      let signature: string | null = null;
      
      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 't') timestamp = value;
        if (key === 'v1') signature = value;
      }
      
      if (!timestamp || !signature) {
        this.logger.warn('Invalid webhook signature header format');
        return false;
      }
      
      // Check timestamp staleness (5 minute tolerance)
      const currentTime = Math.floor(Date.now() / 1000);
      const timestampNum = parseInt(timestamp, 10);
      if (currentTime - timestampNum > 300) {
        this.logger.warn('Webhook timestamp too old');
        return false;
      }
      
      // Verify signature
      const crypto = require('crypto');
      const signedPayload = `${timestamp}.${payloadString}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');
      
      return signature === expectedSignature;
    } catch (error: any) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      return false;
    }
  }

  verifyCallback(
    payload: unknown,
    signature?: string,
    _timestamp?: string
  ): boolean {
    if (!payload || typeof payload !== 'object') return false;
    if (!signature) return false;
    
    return this.verifyWebhookSignature(
      JSON.stringify(payload),
      signature
    );
  }

  async getSupportedPaymentMethods(): Promise<string[]> {
    return ['mobile_money'];
  }

  getCallbackUrl(): string {
    return this.config.callbackUrl;
  }

  async testConnection(): Promise<boolean> {
    return !!(
      this.config.secretKey &&
      this.config.webhookSecret &&
      this.config.callbackUrl
    );
  }

  generateMockCallback(
    mockReference: string,
    externalId?: string,
    outcome?: 'approved' | 'declined'
  ): FedaPayCallbackDto {
    const stored = this.mockOutcomes.get(mockReference);
    const storedOutcome = stored?.outcome === 'pending' ? undefined : stored?.outcome;
    const finalOutcome = outcome ?? storedOutcome ?? 'approved';

    return {
      entity: {
        id: parseInt(mockReference.replace('mock-', '').split('-')[0], 36),
        status: finalOutcome,
        amount: stored?.amount || 0,
        reference: mockReference,
        custom_metadata: { externalId },
      },
      name: finalOutcome === 'approved' ? 'transaction.approved' : 'transaction.declined',
    };
  }
}
