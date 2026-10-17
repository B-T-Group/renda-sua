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
import { sanitizeProviderError, maskPhoneNumber } from '../sanitize-provider-error.util';

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
  /**
   * True when the FedaPay object was created but the follow-up push/send
   * failed or timed out. The outcome is unknown: callers must keep the row
   * pending with this transactionId and let the webhook / polling decide.
   */
  ambiguous?: boolean;
}

export interface FedaPayWithdrawalResponse {
  success: boolean;
  transactionId?: string;
  reference?: string;
  message?: string;
  errorCode?: string;
  status?: string;
  /** See FedaPayPaymentResponse.ambiguous. */
  ambiguous?: boolean;
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
        const sanitized = sanitizeProviderError(error);
        this.logger.error(
          `Failed to process auto-callback for ${mockReference}: ${sanitized.message}`
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
        `🔨 MOCK FedaPay payment: payer=${maskPhoneNumber(paymentRequest.payer)} is on FEDAPAY_MOCK_PENDING_PHONES, reference=${externalId}, mock_ref=${mockRef}: stays pending (no auto-callback)`
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
      `🔨 MOCK FedaPay payment: amount=${paymentRequest.amount} XOF, payer=${maskPhoneNumber(paymentRequest.payer)}, channel=${paymentRequest.channel}, reference=${externalId}, mock_ref=${mockRef}, outcome=${outcome} (callback will be scheduled after DB persist)`
    );

    // G2: DO NOT schedule here - caller must schedule AFTER persisting mock id
    // this.scheduleAutoCallback(mockRef, externalId, outcome);

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
      `🔨 MOCK FedaPay payout: amount=${withdrawalRequest.amount} XOF, payee=${maskPhoneNumber(withdrawalRequest.payee)}, channel=${withdrawalRequest.channel}, reference=${externalId}, mock_ref=${mockRef}, outcome=${outcome} (auto-callback will be scheduled after DB persist)`
    );

    // G2: DO NOT schedule auto-callback here - caller must schedule after persisting mock id

    return {
      success: true,
      transactionId: mockRef,
      reference: mockRef,
      status: 'pending',
      message: normalizeProviderMessage(null, 'Mock payout initiated'),
    };
  }

  /**
   * G2: Schedule auto-callback for mock payment/payout AFTER the mock id has been persisted.
   * Must be called by controller/service after updateTransaction completes.
   */
  scheduleMockCallback(mockRef: string, externalId: string): void {
    if (!this.mockEnabled || !mockRef.startsWith('mock-')) {
      return;
    }
    const stored = this.mockOutcomes.get(mockRef);
    if (!stored) {
      this.logger.warn(`Cannot schedule callback for ${mockRef}: not found in mockOutcomes`);
      return;
    }
    this.scheduleAutoCallback(mockRef, externalId, stored.outcome === 'pending' ? 'approved' : stored.outcome);
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
        let token: any;
        try {
          const tokenResponse = await txData.generateToken();
          token = tokenResponse?.token || tokenResponse;

          await txData.sendNowWithToken(paymentRequest.channel, token, {
            phone_number: {
              number: paymentRequest.payer,
              country: 'TG',
            },
          });
        } catch (pushError: any) {
          // N2: the FedaPay transaction exists, so the push may still reach the
          // customer. Never report failure here: hand back the FedaPay id so the
          // caller stores it on the row (pending). The approved/declined webhook,
          // FedaPay's own expiry (-> canceled) or polling then resolves it.
          const sanitized = sanitizeProviderError(pushError);
          this.logger.warn(
            `FedaPay push failed after transaction ${transaction.id} was created ` +
              `(externalId=${externalId}); keeping it pending: ${sanitized.message}`
          );
          return {
            success: true,
            ambiguous: true,
            transactionId: String(transaction.id),
            reference: String(transaction.id),
            status: 'pending',
            message: normalizeProviderMessage(
              null,
              'Payment created; awaiting confirmation'
            ),
          };
        }

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
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Failed to initiate FedaPay payment: ${sanitized.message}`);
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
      // Note: FedaPay API may not filter by custom_metadata server-side,
      // so we fetch all and filter client-side
      try {
        const existingPayouts = await Payout.all({
          'custom_metadata.externalId': externalId,
        });
        const payouts = (existingPayouts as any)?.payouts || [];
        const matching = payouts.find((p: any) => p.custom_metadata?.externalId === externalId);
        if (matching) {
          this.logger.log(
            `Found existing FedaPay payout for ${externalId}: ${matching.id} (status=${matching.status})`
          );
          return this.resumeExistingPayout(matching, externalId);
        }
      } catch (lookupError: any) {
        // Fail closed: don't create if lookup fails, let it retry
        const sanitized = sanitizeProviderError(lookupError);
        this.logger.error(`Payout lookup failed for ${externalId}: ${sanitized.message}`);
        throw new Error(`Failed to check existing payout: ${sanitized.message}`);
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
        // N1: from here on a FedaPay payout exists. Nothing below may report a
        // plain failure (that would release the hold while money may go out).
        return this.sendCreatedPayout(payout, externalId);
      }

      return {
        success: false,
        message: normalizeProviderMessage(null, 'Payout initiation failed'),
        errorCode: 'INITIATION_FAILED',
        status: 'failed',
      };
    } catch (error: any) {
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Failed to initiate FedaPay payout: ${sanitized.message}`);
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

  /**
   * Send a payout that already exists at FedaPay. Any error is treated as
   * ambiguous (pending) unless a Payout.retrieve confirms it failed.
   */
  private async sendCreatedPayout(
    payout: any,
    externalId: string | undefined
  ): Promise<FedaPayWithdrawalResponse> {
    const payoutId = String(payout.id);
    try {
      await payout.sendNow();
      return {
        success: true,
        transactionId: payoutId,
        reference: externalId,
        status: payout.status || 'pending',
        message: normalizeProviderMessage(null, 'Payout initiated'),
      };
    } catch (sendError: any) {
      const sanitized = sanitizeProviderError(sendError);
      this.logger.warn(
        `FedaPay payout ${payoutId} created but sendNow failed (externalId=${externalId}): ${sanitized.message}; reconciling via Payout.retrieve`
      );
      return this.reconcileAmbiguousPayout(payoutId, externalId);
    }
  }

  /**
   * After an ambiguous send, ask FedaPay what actually happened. Only a
   * confirmed `failed` is reported as failure; anything else (including a
   * retrieve error) stays pending with the payout id so polling decides.
   */
  private async reconcileAmbiguousPayout(
    payoutId: string,
    externalId: string | undefined
  ): Promise<FedaPayWithdrawalResponse> {
    let liveStatus: string | undefined;
    try {
      const live: any = await Payout.retrieve(parseInt(payoutId, 10));
      liveStatus = live?.status;
    } catch (retrieveError: any) {
      const sanitized = sanitizeProviderError(retrieveError);
      this.logger.warn(
        `FedaPay payout ${payoutId} retrieve after failed send also failed: ${sanitized.message}`
      );
    }
    if (liveStatus === 'failed') {
      return {
        success: false,
        transactionId: payoutId,
        reference: externalId,
        status: 'failed',
        errorCode: 'PAYOUT_FAILED',
        message: normalizeProviderMessage(null, 'Payout failed'),
      };
    }
    return {
      success: true,
      ambiguous: true,
      transactionId: payoutId,
      reference: externalId,
      status: liveStatus || 'pending',
      message: normalizeProviderMessage(
        null,
        'Payout created; awaiting confirmation'
      ),
    };
  }

  /**
   * Dedupe hit: an existing payout for this externalId. Pass through terminal
   * states; (re)send one that was created but never sent.
   */
  private async resumeExistingPayout(
    matching: any,
    externalId: string | undefined
  ): Promise<FedaPayWithdrawalResponse> {
    const payoutId = String(matching.id);
    const status = String(matching.status || 'pending');
    if (status === 'failed') {
      return {
        success: false,
        transactionId: payoutId,
        reference: externalId,
        status: 'failed',
        errorCode: 'PAYOUT_FAILED',
        message: normalizeProviderMessage(null, 'Existing payout failed'),
      };
    }
    if (status === 'pending') {
      // Created but never sent (e.g. an earlier sendNow failed): resend it.
      let existing: any;
      try {
        existing = await Payout.retrieve(parseInt(payoutId, 10));
      } catch (retrieveError: any) {
        const sanitized = sanitizeProviderError(retrieveError);
        this.logger.warn(
          `FedaPay payout ${payoutId} retrieve for resend failed: ${sanitized.message}`
        );
      }
      if (existing && typeof existing.sendNow === 'function') {
        return this.sendCreatedPayout(existing, externalId);
      }
      return {
        success: true,
        ambiguous: true,
        transactionId: payoutId,
        reference: externalId,
        status: 'pending',
        message: normalizeProviderMessage(
          null,
          'Payout exists; awaiting confirmation'
        ),
      };
    }
    // sent / started / processing / scheduled: already on its way.
    return {
      success: true,
      transactionId: payoutId,
      reference: externalId,
      status,
      message: normalizeProviderMessage(null, 'Payout already exists'),
    };
  }

  async checkPayoutStatus(
    payoutId: string
  ): Promise<FedaPayTransactionStatus> {
    if (this.mockEnabled && this.isMockedTransaction(payoutId)) {
      return this.getMockTransactionStatus(payoutId);
    }

    try {
      this.logger.log(`Checking FedaPay payout status: ${payoutId}`);

      const payout = await Payout.retrieve(parseInt(payoutId, 10), { include: 'currency' });

      if (!payout) {
        throw new Error(`Payout ${payoutId} not found`);
      }

      const payoutData: any = payout;
      const customMeta = payoutData.custom_metadata || {};
      const currency = payoutData.currency?.iso || ''; // Fail closed on missing currency

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
      const sanitized = sanitizeProviderError(error);
      this.logger.error(
        `Failed to check FedaPay payout status: ${sanitized.message}`
      );
      throw new Error(sanitized.message);
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

      const transaction = await Transaction.retrieve(parseInt(reference, 10), { include: 'currency' });

      if (!transaction) {
        throw new Error(`Transaction ${reference} not found`);
      }

      const txData: any = transaction;
      const customMeta = txData.custom_metadata || {};
      const currency = txData.currency?.iso || ''; // Fail closed on missing currency

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
      const sanitized = sanitizeProviderError(error);
      this.logger.error(
        `Failed to check FedaPay transaction status: ${sanitized.message}`,
        sanitized.status ? `Status: ${sanitized.status}` : undefined,
        sanitized.code ? `Code: ${sanitized.code}` : undefined
      );
      throw new Error(sanitized.message);
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
