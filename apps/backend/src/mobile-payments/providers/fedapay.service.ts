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
import {
  sanitizeProviderError,
  maskPhoneNumber,
  toSanitizedError,
} from '../sanitize-provider-error.util';

/** #615 QA L1: bound on one live FedaPay retrieve (the SDK has no timeout). */
export const FEDAPAY_LIVE_LOOKUP_TIMEOUT_MS = 10_000;
/** QA #621 I3: log marker for a live lookup that hit the timeout (metric filter / alarm). */
export const FEDAPAY_LIVE_LOOKUP_TIMEOUT_MARKER = 'fedapay_live_lookup_timeout';

export class FedaPayLiveLookupTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FedaPayLiveLookupTimeoutError';
  }
}

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
  /** A cron resend of a row that already has a send-attempt marker. */
  markedResend?: boolean;
  /** When false, an empty list is not proof the payout is absent. */
  trustEmptyList?: boolean;
  /** Decline refunds only. Wallet withdrawals keep the unfiltered create. */
  strictList?: boolean;
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

/**
 * GET /transactions/:id returns `currency_id`, not `currency.iso`.
 * Official FedaPay examples use id 1 for XOF (the only collect currency).
 */
const FEDAPAY_CURRENCY_ID_TO_ISO: Record<string, string> = { '1': 'XOF' };

function readFedaPayCurrencyIso(data: {
  currency?: { iso?: string | null } | null;
  currency_id?: number | string | null;
} | null | undefined): string {
  const iso = data?.currency?.iso?.trim();
  if (iso) return iso.toUpperCase();
  const id = data?.currency_id;
  if (id === undefined || id === null || id === '') return '';
  return FEDAPAY_CURRENCY_ID_TO_ISO[String(id)] ?? '';
}

function readFedaPayMerchantRef(data: {
  custom_metadata?: { externalId?: string | null } | null;
  merchant_reference?: string | null;
} | null | undefined): string {
  return data?.custom_metadata?.externalId?.trim()
    || data?.merchant_reference?.trim()
    || '';
}

export interface FedaPayExternalMatch {
  found: boolean;
  status: string | null;
  id: string | null;
  unknown: boolean;
  provableEmpty: boolean;
  matches: Array<{ id: string; status: string }>;
}

type PayoutRow = { id?: number | string; status?: string; custom_metadata?: { externalId?: string } };

type StrictWalk = {
  match: FedaPayExternalMatch;
  complete: boolean;
  pages: number;
  total: number | null;
  digest: string;
};

type WalkState = { page: number; seen: number; pages: number; total: number | null };

const PAID_PAYOUT = new Set(['sent', 'approved', 'successful', 'success', 'transferred']);
const OPEN_PAYOUT = new Set(['pending', 'started', 'processing', 'scheduled']);
const DEAD_PAYOUT = new Set(['failed', 'failure', 'declined', 'canceled', 'cancelled', 'rejected']);

function unknownLook(): FedaPayExternalMatch {
  return { found: false, status: null, id: null, unknown: true, provableEmpty: false, matches: [] };
}

function emptyLook(): FedaPayExternalMatch {
  return { found: false, status: null, id: null, unknown: false, provableEmpty: true, matches: [] };
}

/** Hard stop so a missing page cursor cannot walk the payout list forever. */
export const FEDAPAY_LIST_PAGE_CAP = 20;
/** One booking tick may list this many pages, across the lookup and the withdraw. */
export const FEDAPAY_LIST_CALL_BUDGET = 20;
/** Shared by the walks in one tick. Two walks stay inside the two-minute claim. */
export const FEDAPAY_LIST_WALK_MS = 90_000;
const FEDAPAY_LIST_TICK_MS = 45_000;

type ListSpend = { start: number; used: number };
const listSpend = new Map<string, ListSpend>();

/** Tests start a tick with a fresh list budget. Production ticks are separated by the retry wait. */
export function resetFedapayListSpend(): void {
  listSpend.clear();
}

function tickSpend(externalId: string, now: number): ListSpend {
  const row = listSpend.get(externalId);
  if (!row || now - row.start > FEDAPAY_LIST_TICK_MS) {
    const fresh = { start: now, used: 0 };
    listSpend.set(externalId, fresh);
    return fresh;
  }
  return row;
}

/** A page is complete only when meta says there is no next page. A paid match still wins. */
export function classifyFedapayPayouts(existing: unknown, externalId: string): FedaPayExternalMatch {
  const rows = payoutRows(existing);
  if (!rows) return unknownLook();
  return classifyStrictRows(rows, externalId, listPageEnded(existing, uniqueRowCount(rows)));
}

export function classifyStrictRows(rows: PayoutRow[], externalId: string, complete: boolean): FedaPayExternalMatch {
  const matches = matchedPayouts(rows, externalId);
  if (paidMatch(matches)) return aggregatePayouts(matches);
  if (!complete) return unknownLook();
  if (matches.length) return aggregatePayouts(matches);
  if (rows.some((row) => externalOf(row) == null) || rows.length > 0) return unknownLook();
  return emptyLook();
}

/** `next_page: null` and a total that matches every distinct row walked. An empty body with no meta is the whole list. */
export function listPageEnded(existing: unknown, rowCount: number): boolean {
  const meta = readMeta(existing);
  if (!meta) return rowCount === 0;
  if (!explicitLastPage(meta) || earlierPage(meta)) return false;
  const total = listedTotal(meta);
  return total != null && total === rowCount;
}

export function uniqueRowCount(rows: PayoutRow[]): number {
  return new Set(rows.map((row, index) => rowKey(row, index))).size;
}

export function listDigest(rows: PayoutRow[]): string {
  const keys = rows.map((row, index) => `${rowKey(row, index)}:${String(row.status ?? '').toLowerCase()}`);
  return [...new Set(keys)].sort().join('|');
}

/** The next page to request. Null when meta does not name one. */
export function nextListPage(existing: unknown, requested: number): number | null {
  const meta = readMeta(existing);
  if (!meta || explicitLastPage(meta)) return null;
  const next = num(meta.next_page ?? meta.nextPage);
  if (Number.isFinite(next) && next > requested) return next;
  const pages = num(meta.total_pages ?? meta.totalPages);
  const current = num(meta.current_page ?? meta.currentPage ?? requested);
  if (Number.isFinite(pages) && current < pages) return current + 1;
  return null;
}

function payoutRows(existing: unknown): PayoutRow[] | null {
  const payouts = (existing as { payouts?: unknown } | null)?.payouts;
  return Array.isArray(payouts) ? (payouts as PayoutRow[]) : null;
}

function externalOf(row: PayoutRow): string | null {
  const value = row.custom_metadata?.externalId;
  return typeof value === 'string' && value.trim() ? value : null;
}

function matchedPayouts(rows: PayoutRow[], externalId: string): Array<{ id: string; status: string }> {
  return rows.flatMap((row) => {
    if (externalOf(row) !== externalId || row.id == null) return [];
    return [{ id: String(row.id), status: String(row.status || 'pending').toLowerCase() }];
  });
}

function paidMatch(matches: Array<{ status: string }>): boolean {
  return matches.some((row) => PAID_PAYOUT.has(row.status));
}

/** Sent or approved wins. A pending or started payout waits. Credit only when every match is dead. */
export function aggregatePayouts(matches: Array<{ id: string; status: string }>): FedaPayExternalMatch {
  const paid = matches.find((row) => PAID_PAYOUT.has(row.status));
  const open = matches.find((row) => OPEN_PAYOUT.has(row.status) || !DEAD_PAYOUT.has(row.status));
  const chosen = paid ?? open ?? matches[0];
  const status = paid?.status ?? open?.status ?? 'failed';
  return { found: true, status, id: chosen.id, unknown: false, provableEmpty: false, matches };
}

function readMeta(existing: unknown): Record<string, unknown> | null {
  const meta = (existing as { meta?: unknown } | null)?.meta;
  if (!meta || typeof meta !== 'object') return null;
  return meta as Record<string, unknown>;
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function explicitLastPage(meta: Record<string, unknown>): boolean {
  return ('next_page' in meta && meta.next_page === null) || ('nextPage' in meta && meta.nextPage === null);
}

function earlierPage(meta: Record<string, unknown>): boolean {
  const pages = num(meta.total_pages ?? meta.totalPages);
  const current = num(meta.current_page ?? meta.currentPage ?? 1);
  return Number.isFinite(pages) && pages >= 1 && current < pages;
}

function listedTotal(meta: Record<string, unknown>): number | null {
  const total = num(meta.total ?? meta.total_count ?? meta.totalCount);
  return Number.isFinite(total) ? total : null;
}

function rowKey(row: PayoutRow, index: number): string {
  return row.id == null ? `n:${index}` : `id:${row.id}`;
}

function pageTotal(existing: unknown): number | null {
  const meta = readMeta(existing);
  return meta ? listedTotal(meta) : null;
}

function reportedPage(existing: unknown, requested: number): number {
  const meta = readMeta(existing);
  const current = num(meta?.current_page ?? meta?.currentPage ?? requested);
  return Number.isFinite(current) && current > 0 ? current : requested;
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
    if (stored.outcome === 'pending') {
      // M2: FEDAPAY_MOCK_PENDING_PHONES payers stay pending with no callback (DEV
      // pending-path QA: N2/N5/reconciler/supersede). Never auto-approve them.
      this.logger.log(`Mock ${mockRef} is on the pending list: no auto-callback`);
      return;
    }
    this.scheduleAutoCallback(mockRef, externalId, stored.outcome);
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
        // Redacted: the SDK error text can echo the API key or bearer token.
        message: normalizeProviderMessage(
          sanitized.message,
          'Failed to initiate payment'
        ),
        errorCode: error.code || 'INITIATION_FAILED',
        status: 'failed',
      };
    }
  }

  /** Read-only. Does not create a payout. `unknown` means the lookup did not answer. */
  async findPayoutByExternalId(externalId: string): Promise<FedaPayExternalMatch> {
    if (this.mockEnabled) return emptyLook();
    try {
      return await this.strictListLook(externalId);
    } catch (error: any) {
      void error;
      return unknownLook();
    }
  }

  /** Decline lists walk every page. A paid match stops the walk. A multi-page credit needs a second walk. */
  private async strictListLook(externalId: string): Promise<FedaPayExternalMatch> {
    const first = await this.collectStrict(externalId);
    if (!this.needsSecondWalk(first)) return first.match;
    const second = await this.collectStrict(externalId);
    return this.confirmedCredit(first, second);
  }

  private needsSecondWalk(walk: StrictWalk): boolean {
    return walk.complete && walk.pages > 1 && walk.match.status === 'failed';
  }

  private confirmedCredit(first: StrictWalk, second: StrictWalk): FedaPayExternalMatch {
    if (second.match.found && second.match.status !== 'failed') return second.match;
    if (this.sameWalk(first, second)) return first.match;
    return unknownLook();
  }

  private sameWalk(first: StrictWalk, second: StrictWalk): boolean {
    const sameTotal = first.total != null && first.total === second.total;
    return first.complete && second.complete && sameTotal && first.digest === second.digest;
  }

  private async collectStrict(externalId: string): Promise<StrictWalk> {
    const rows: PayoutRow[] = [];
    const state: WalkState = { page: 1, seen: 0, pages: 0, total: null };
    const began = Date.now();
    for (let step = 0; step < FEDAPAY_LIST_PAGE_CAP; step += 1) {
      const turn = await this.readStrictPage(externalId, state, rows, began);
      if (turn.done) return this.walkResult(rows, externalId, turn.complete, state);
    }
    return this.walkResult(rows, externalId, false, state);
  }

  private walkResult(rows: PayoutRow[], externalId: string, complete: boolean, state: WalkState): StrictWalk {
    const match = classifyStrictRows(rows, externalId, complete);
    return { match, complete, pages: state.pages, total: state.total, digest: listDigest(rows) };
  }

  private async readStrictPage(
    externalId: string,
    state: WalkState,
    rows: PayoutRow[],
    began: number
  ): Promise<{ done: boolean; complete: boolean }> {
    if (!this.allowListCall(externalId, began)) return { done: true, complete: false };
    const body = await this.liveLookup('payout', () => Payout.all(this.listQuery(externalId, state.page)));
    if (!this.acceptPage(body, state, rows)) return { done: true, complete: false };
    if (!classifyStrictRows(rows, externalId, false).unknown) return { done: true, complete: false };
    if (listPageEnded(body, uniqueRowCount(rows))) return { done: true, complete: true };
    const next = nextListPage(body, state.seen);
    if (next == null) return { done: true, complete: false };
    state.page = next;
    return { done: false, complete: false };
  }

  private acceptPage(body: unknown, state: WalkState, rows: PayoutRow[]): boolean {
    const pageRows = payoutRows(body);
    const current = reportedPage(body, state.page);
    if (!pageRows || current <= state.seen || this.totalsSplit(state, body)) return false;
    const total = pageTotal(body);
    if (total != null) state.total = total;
    rows.push(...pageRows);
    state.seen = current;
    state.pages += 1;
    return true;
  }

  private totalsSplit(state: WalkState, body: unknown): boolean {
    const total = pageTotal(body);
    return state.total != null && total != null && state.total !== total;
  }

  /** The call budget and the clock are shared by every walk for this booking in the tick. */
  private allowListCall(externalId: string, began: number): boolean {
    const now = Date.now();
    if (now - began >= FedaPayService.listWalkMs) return false;
    const row = tickSpend(externalId, now);
    if (row.used >= FedaPayService.listCallBudget) return false;
    row.used += 1;
    return true;
  }

  private listQuery(externalId: string, page: number): Record<string, string | number> {
    const query: Record<string, string | number> = { 'custom_metadata.externalId': externalId };
    if (page > 1) query.page = page;
    return query;
  }

  /** A 4xx means FedaPay refused the create. A timeout or 5xx may have created it. */
  private clientStatus(error: any): boolean {
    const direct = Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? 0);
    if (direct >= 400 && direct < 500) return true;
    return /\b4\d{2}\b/.test(String(error?.message ?? ''));
  }

  private async afterCreateError(error: any, externalId: string | undefined, markedResend: boolean): Promise<FedaPayWithdrawalResponse> {
    if (!externalId) return this.unknownWithdraw();
    const reused = await this.reuseByExternalId(externalId, true);
    if (reused) return reused;
    if (this.clientStatus(error) && !markedResend) return this.failedWithdraw(error);
    return this.unknownWithdraw();
  }

  /** Wallet withdrawals create when no row has this external id, even if the page is foreign. */
  private async reuseOpenList(externalId: string): Promise<FedaPayWithdrawalResponse | null> {
    const existingPayouts = await Payout.all({ 'custom_metadata.externalId': externalId });
    const payouts = (existingPayouts as { payouts?: Array<{ custom_metadata?: { externalId?: string } }> } | null)?.payouts || [];
    const matching = payouts.find((row) => row.custom_metadata?.externalId === externalId);
    if (!matching) return null;
    this.logger.log(`Found existing FedaPay payout for ${externalId}: ${(matching as { id?: unknown }).id} (status=${(matching as { status?: unknown }).status})`);
    return this.resumeOpenPayout(matching, externalId);
  }

  /** A 4xx is a refusal. A lookup that finds nothing after a 5xx is a refusal too. */
  private async openCreateError(error: any, externalId: string | undefined): Promise<FedaPayWithdrawalResponse> {
    if (this.clientStatus(error) || !externalId) return this.failedWithdraw(error);
    const looked = await this.openFind(externalId);
    if (looked.found || looked.unknown) return this.pendingWithdraw(externalId, looked);
    return this.failedWithdraw(error);
  }

  /** The pre-create list throws. The after-create list uses the same timeout as main. */
  private async openFind(externalId: string): Promise<FedaPayExternalMatch> {
    try {
      const existing = await this.liveLookup('payout', () => Payout.all({ 'custom_metadata.externalId': externalId }));
      const payouts = (existing as { payouts?: Array<{ id?: number | string; status?: string; custom_metadata?: { externalId?: string } }> } | null)?.payouts ?? [];
      const match = payouts.find((row) => row.custom_metadata?.externalId === externalId);
      if (!match) return emptyLook();
      const id = match.id == null ? null : String(match.id);
      return { found: true, status: String(match.status || 'pending'), id, unknown: false, provableEmpty: false, matches: [] };
    } catch (error: any) {
      void error;
      return unknownLook();
    }
  }

  private pendingWithdraw(externalId: string, looked: FedaPayExternalMatch): FedaPayWithdrawalResponse {
    const status = !looked.unknown && looked.status && looked.status !== 'failed' ? looked.status : 'pending';
    return {
      success: !looked.unknown,
      ambiguous: true,
      transactionId: looked.id ?? undefined,
      reference: externalId,
      status,
      message: normalizeProviderMessage(null, 'Payout created; awaiting confirmation'),
    };
  }

  /** Reuse any match. Create only when the caller already confirmed an empty list. */
  private async reuseByExternalId(externalId: string, trustEmpty: boolean): Promise<FedaPayWithdrawalResponse | null> {
    const looked = await this.findPayoutByExternalId(externalId);
    if (looked.found && looked.id) return this.resumeExistingPayout({ id: looked.id, status: looked.status }, externalId);
    if (looked.provableEmpty && trustEmpty) return null;
    return this.unknownWithdraw();
  }

  /** The create may have landed, but the lookup did not answer. Store no reference. */
  private unknownWithdraw(): FedaPayWithdrawalResponse {
    return {
      success: false,
      ambiguous: true,
      status: 'pending',
      message: normalizeProviderMessage(null, 'Payout created; awaiting confirmation'),
    };
  }

  private failedWithdraw(error: any): FedaPayWithdrawalResponse {
    const sanitized = sanitizeProviderError(error);
    this.logger.error(`Failed to initiate FedaPay payout: ${sanitized.message}`);
    return {
      success: false,
      message: normalizeProviderMessage(sanitized.message, 'Failed to initiate payout'),
      errorCode: error?.code || 'WITHDRAWAL_FAILED',
      status: 'failed',
    };
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

      const strict = withdrawalRequest.strictList === true;
      const trustEmpty = withdrawalRequest.trustEmptyList !== false;
      const reused = strict
        ? await this.reuseByExternalId(externalId, trustEmpty)
        : await this.reuseOpenList(externalId);
      if (reused) return reused;

      let payout: { id?: number | string; status?: string; sendNow?: () => Promise<unknown> };
      try {
        payout = await Payout.create({
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
      } catch (error: any) {
        if (!strict) return this.openCreateError(error, externalId);
        return this.afterCreateError(error, externalId, withdrawalRequest.markedResend === true);
      }

      if (payout && payout.id) {
        // N1: from here on a FedaPay payout exists. Nothing below may report a
        // plain failure (that would release the hold while money may go out).
        return this.sendCreatedPayout(payout, externalId, strict);
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
        // Redacted: the SDK error text can echo the API key or bearer token.
        message: normalizeProviderMessage(
          sanitized.message,
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
    externalId: string | undefined,
    strict = false
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
      return this.reconcileAmbiguousPayout(payoutId, externalId, strict);
    }
  }

  /**
   * After an ambiguous send, ask FedaPay what actually happened. Only a
   * confirmed `failed` is reported as failure; anything else (including a
   * retrieve error) stays pending with the payout id so polling decides.
   */
  private async reconcileAmbiguousPayout(
    payoutId: string,
    externalId: string | undefined,
    strict: boolean
  ): Promise<FedaPayWithdrawalResponse> {
    let liveStatus: string | undefined;
    try {
      const live: any = await this.liveLookup('payout', () => Payout.retrieve(parseInt(payoutId, 10)));
      liveStatus = live?.status;
    } catch (retrieveError: any) {
      const sanitized = sanitizeProviderError(retrieveError);
      this.logger.warn(
        `FedaPay payout ${payoutId} retrieve after failed send also failed: ${sanitized.message}`
      );
    }
    if (this.reconcileFailed(liveStatus, strict)) return this.reconcileFailure(payoutId, externalId, strict);
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
  private reconcileFailed(status: string | undefined, strict: boolean): boolean {
    if (!status) return false;
    return strict ? this.terminalPayout(status) : status === 'failed';
  }

  private reconcileFailure(payoutId: string, externalId: string | undefined, strict: boolean): FedaPayWithdrawalResponse {
    if (strict) return this.failedExisting(payoutId, externalId);
    return {
      success: false,
      transactionId: payoutId,
      reference: externalId,
      status: 'failed',
      errorCode: 'PAYOUT_FAILED',
      message: normalizeProviderMessage(null, 'Payout failed'),
    };
  }

  /** Non-strict resume matches main: a canceled payout is passed through, and a missed retrieve keeps the id. */
  private async resumeOpenPayout(matching: any, externalId: string | undefined): Promise<FedaPayWithdrawalResponse> {
    const payoutId = String(matching.id);
    const status = String(matching.status || 'pending');
    if (status === 'failed') return this.failedExisting(payoutId, externalId);
    if (status !== 'pending') return this.passedPayout(payoutId, externalId, status);
    return this.openResend(payoutId, externalId);
  }

  private async openResend(payoutId: string, externalId: string | undefined): Promise<FedaPayWithdrawalResponse> {
    const existing = await this.retrieveForResend(payoutId);
    if (existing && typeof existing.sendNow === 'function') return this.sendCreatedPayout(existing, externalId, false);
    return {
      success: true,
      ambiguous: true,
      transactionId: payoutId,
      reference: externalId,
      status: 'pending',
      message: normalizeProviderMessage(null, 'Payout exists; awaiting confirmation'),
    };
  }

  private terminalPayout(status: string): boolean {
    return status === 'failed' || status === 'canceled' || status === 'cancelled';
  }

  private failedExisting(payoutId: string, externalId: string | undefined): FedaPayWithdrawalResponse {
    return {
      success: false,
      transactionId: payoutId,
      reference: externalId,
      status: 'failed',
      errorCode: 'PAYOUT_FAILED',
      message: normalizeProviderMessage(null, 'Existing payout failed'),
    };
  }

  private passedPayout(payoutId: string, externalId: string | undefined, status: string): FedaPayWithdrawalResponse {
    return {
      success: true,
      transactionId: payoutId,
      reference: externalId,
      status,
      message: normalizeProviderMessage(null, 'Payout already exists'),
    };
  }

  private async resumeExistingPayout(matching: any, externalId: string | undefined): Promise<FedaPayWithdrawalResponse> {
    const payoutId = String(matching.id);
    const status = String(matching.status || 'pending');
    if (this.terminalPayout(status)) return this.failedExisting(payoutId, externalId);
    if (status !== 'pending') return this.passedPayout(payoutId, externalId, status);
    return this.resendIfStillPending(payoutId, externalId);
  }

  /** Send only while the retrieved payout is still pending. A missed read stores no ref. */
  private async resendIfStillPending(payoutId: string, externalId: string | undefined): Promise<FedaPayWithdrawalResponse> {
    const existing = await this.retrieveForResend(payoutId);
    const live = String(existing?.status || '');
    if (this.terminalPayout(live)) return this.failedExisting(payoutId, externalId);
    if (live === 'pending' && typeof existing?.sendNow === 'function') return this.sendCreatedPayout(existing, externalId, true);
    if (live) return this.passedPayout(payoutId, externalId, live);
    return this.unknownWithdraw();
  }

  private async retrieveForResend(payoutId: string): Promise<any> {
    try {
      return await this.liveLookup('payout', () => Payout.retrieve(parseInt(payoutId, 10)));
    } catch (retrieveError: any) {
      const sanitized = sanitizeProviderError(retrieveError);
      this.logger.warn(`FedaPay payout ${payoutId} retrieve for resend failed: ${sanitized.message}`);
      return null;
    }
  }

  /**
   * #615 QA L1: the FedaPay SDK sets no request timeout, so a lookup that never
   * settles would hang the webhook (and the payout flows) indefinitely. Every live
   * retrieve is bounded; on timeout it rejects like any other lookup error, so the
   * callers' existing handling applies (pending path: 5xx so FedaPay retries;
   * after-credit path: alert; ambiguous payout: stays pending for polling).
   */
  static liveLookupTimeoutMs = FEDAPAY_LIVE_LOOKUP_TIMEOUT_MS;
  static listCallBudget = FEDAPAY_LIST_CALL_BUDGET;
  static listWalkMs = FEDAPAY_LIST_WALK_MS;

  private async liveLookup<T>(kind: 'transaction' | 'payout', lookup: () => Promise<T>): Promise<T> {
    const ms = FedaPayService.liveLookupTimeoutMs;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        // QA #621 I3: stable CloudWatch marker (one line per timed-out lookup).
        this.logger.error(`${FEDAPAY_LIVE_LOOKUP_TIMEOUT_MARKER} kind=${kind} timeout_ms=${ms}`);
        reject(new FedaPayLiveLookupTimeoutError(`FedaPay ${kind} lookup timed out after ${ms}ms`));
      }, ms);
    });
    try {
      return await Promise.race([lookup(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
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

      const payout = await this.liveLookup('payout', () => Payout.retrieve(parseInt(payoutId, 10), { include: 'currency' }));

      if (!payout) {
        throw new Error(`Payout ${payoutId} not found`);
      }

      const payoutData: any = payout;
      const currency = readFedaPayCurrencyIso(payoutData);

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
        merchantRef: readFedaPayMerchantRef(payoutData),
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
      throw toSanitizedError(error);
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

      const transaction = await this.liveLookup('transaction', () =>
        Transaction.retrieve(parseInt(reference, 10), { include: 'currency' })
      );

      if (!transaction) {
        throw new Error(`Transaction ${reference} not found`);
      }

      const txData: any = transaction;
      const currency = readFedaPayCurrencyIso(txData);

      return {
        transactionId: String(transaction.id),
        status: txData.status || 'pending',
        amount: txData.amount,
        currency,
        reference: String(transaction.id),
        merchantRef: readFedaPayMerchantRef(txData),
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
      throw toSanitizedError(error);
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
