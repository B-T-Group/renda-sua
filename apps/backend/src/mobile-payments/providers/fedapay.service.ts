import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { randomUUID } from 'crypto';
import {
  FedaPay,
  Transaction,
  Payout,
  Webhook,
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
    if (this.mockEnabled) {
      return this.mockInitiatePayment(paymentRequest, reference);
    }

    try {
      const externalId = reference || paymentRequest.externalId;
      this.logger.log(
        `Initiating FedaPay payment for payer: ${paymentRequest.payer}, channel: ${paymentRequest.channel}, externalId: ${externalId}`
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
        await txData.generateToken();
        
        return {
          success: true,
          transactionId: String(transaction.id),
          reference: String(transaction.id),
          token: txData.token,
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
      this.logger.error('Failed to initiate FedaPay payment:', error);
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
    if (this.mockEnabled) {
      return this.mockWithdraw(withdrawalRequest, reference);
    }

    try {
      const externalId = reference || withdrawalRequest.externalId;
      this.logger.log(
        `Initiating FedaPay payout for payee: ${withdrawalRequest.payee}, channel: ${withdrawalRequest.channel}, externalId: ${externalId}`
      );

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
      });

      if (payout && payout.id) {
        const payoutData: any = payout;
        await payoutData.sendNow();
        
        return {
          success: true,
          transactionId: String(payout.id),
          reference: String(payout.id),
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
      this.logger.error('Failed to initiate FedaPay payout:', error);
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

  async checkTransactionStatus(
    reference: string
  ): Promise<FedaPayTransactionStatus> {
    if (this.isMockedTransaction(reference)) {
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

      return {
        transactionId: String(transaction.id),
        status: txData.status || 'pending',
        amount: txData.amount,
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
        'Failed to check FedaPay transaction status:',
        error
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
    signature: string,
    webhookSecret?: string
  ): boolean {
    try {
      const secret = webhookSecret || this.config.webhookSecret;
      if (!secret) {
        this.logger.warn('Webhook secret not configured, skipping signature verification');
        return false;
      }

      const event = Webhook.constructEvent(payload, signature, secret);
      return !!event;
    } catch (error: any) {
      this.logger.error('Webhook signature verification failed:', error);
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
