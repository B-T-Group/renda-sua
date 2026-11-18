import { Injectable } from '@nestjs/common';
import { FedaPayService } from '../../mobile-payments/providers/fedapay.service';
import { FreemopayService } from '../../mobile-payments/providers/freemopay.service';
import { MyPVitService } from '../../mobile-payments/providers/mypvit.service';
import { MtnMomoService } from '../../mtn-momo/mtn-momo.service';
import { mapRefundPoll, providerRefundPlan, type ProviderRefundPlan, type RefundStatus } from './pickup-decline.money';

export interface MomoRefundRequest {
  bookingId: string;
  amount: number;
  currency: string;
  provider: string;
  phone: string | null;
  transactionId: string | null;
  channel?: 'moov_tg' | 'togocel' | null;
  /** Stable provider reference. A retry sends this same id. */
  referenceId?: string | null;
}

export interface MomoRefundResult {
  status: RefundStatus;
  provider: string;
  providerRef: string | null;
  unsupported: boolean;
  /** The withdrawal never reached the provider. The caller may clear refund_sent_at. */
  unsent?: boolean;
}

@Injectable()
export class RentalMomoRefundService {
  constructor(
    private readonly mtn: MtnMomoService,
    private readonly freemopay: FreemopayService,
    private readonly fedapay: FedaPayService,
    private readonly mypvit: MyPVitService
  ) {}

  async refund(request: MomoRefundRequest): Promise<MomoRefundResult> {
    const plan = providerRefundPlan(request.provider);
    if (plan === 'unsupported') return this.unsupported(request.provider);
    const started = await this.initiate(plan, request);
    if (started.unsent || !started.providerRef || started.status !== 'refund_pending') return started;
    return this.finishPoll(plan, started.providerRef);
  }

  async poll(provider: string, providerRef: string): Promise<RefundStatus> {
    const probed = await this.probe(provider, providerRef);
    if (probed === 'missing' || probed === 'unknown') return 'refund_pending';
    return probed;
  }

  /** `missing` is a 404. `unknown` is a lookup that did not prove the payout is absent. */
  async probe(provider: string, providerRef: string): Promise<RefundStatus | 'missing' | 'unknown'> {
    const plan = providerRefundPlan(provider);
    if (plan === 'unsupported') return 'refund_pending';
    const looked = await this.lookup(plan, providerRef);
    if (looked.kind === 'missing') return 'missing';
    if (looked.kind === 'unknown') return 'unknown';
    return mapRefundPoll(looked.code);
  }

  private async unsupported(provider: string): Promise<MomoRefundResult> {
    await this.noteMypvitHasNoRefund(provider);
    return { status: 'refund_pending', provider, providerRef: null, unsupported: true };
  }

  /** MyPVit can list methods. It cannot refund a collect that already succeeded. */
  private async noteMypvitHasNoRefund(provider: string): Promise<void> {
    if (provider.trim().toLowerCase() !== 'mypvit') return;
    const methods = await this.mypvit.getSupportedPaymentMethods();
    if (!methods.includes('refund')) return;
  }

  private initiate(plan: ProviderRefundPlan, request: MomoRefundRequest): Promise<MomoRefundResult> {
    if (plan === 'mtn') return this.initiateMtn(request);
    if (plan === 'freemopay') return this.initiateFreemopay(request);
    if (plan === 'fedapay') return this.initiateFedapay(request);
    return Promise.resolve(this.pending(request.provider, null, true));
  }

  private async initiateMtn(request: MomoRefundRequest): Promise<MomoRefundResult> {
    const sent = await this.mtn.transfer({
      amount: String(request.amount),
      currency: request.currency,
      externalId: this.externalId(request.bookingId),
      referenceId: request.referenceId ?? undefined,
      payee: { partyIdType: 'MSISDN', partyId: this.msisdn(request.phone) },
      payerMessage: 'Rental condition decline refund',
      payeeNote: request.bookingId,
    });
    if (!sent.status && !sent.statusCode) return this.unsentResult('mtn');
    const code = Number(sent.statusCode);
    if (!sent.status && code >= 400 && code < 500) return this.failed('mtn', sent.financialTransactionId ?? null);
    return this.pending('mtn', sent.financialTransactionId ?? null, false);
  }

  /** The first attempt does not look up. Nothing has been sent before this call. */
  private async initiateFreemopay(request: MomoRefundRequest): Promise<MomoRefundResult> {
    return this.sendFreemopay(request, this.stableId(request));
  }

  private async initiateFedapay(request: MomoRefundRequest): Promise<MomoRefundResult> {
    const sent = await this.fedapay.withdraw({
      payee: this.msisdn(request.phone),
      amount: request.amount,
      externalId: this.externalId(request.bookingId),
      description: 'Rental condition decline refund',
      callback: this.callbackUrl('fedapay'),
      channel: request.channel === 'moov_tg' ? 'moov_tg' : 'togocel',
    });
    const ref = sent.transactionId ?? sent.reference ?? null;
    if (!sent.success && !sent.ambiguous) return this.failed('fedapay', ref);
    return this.pending('fedapay', ref, false);
  }

  private async sendFreemopay(request: MomoRefundRequest, externalId: string): Promise<MomoRefundResult> {
    const sent = await this.freemopay.withdraw({
      payee: this.msisdn(request.phone),
      amount: request.amount,
      externalId,
      description: 'Rental condition decline refund',
      callback: this.callbackUrl('freemopay'),
    });
    const ref = sent.reference || sent.transactionId || externalId;
    if (sent.unsent) return this.unsentResult('freemopay');
    if (!sent.success && sent.ambiguous) return this.pending('freemopay', externalId, false);
    if (!sent.success) return this.failed('freemopay', sent.reference ?? sent.transactionId ?? null);
    return this.pending('freemopay', ref, false);
  }

  private async finishPoll(plan: ProviderRefundPlan, ref: string): Promise<MomoRefundResult> {
    const looked = await this.lookup(plan, ref);
    if (looked.kind !== 'code') return this.pending(plan, ref, false);
    return this.fromCode(plan, ref, looked.code);
  }

  private async lookup(plan: ProviderRefundPlan, ref: string): Promise<PollLook> {
    if (plan === 'mtn') return this.lookupMtn(ref);
    if (plan === 'freemopay') return this.lookupFreemopay(ref);
    if (plan === 'fedapay') return this.lookupFedapay(ref);
    return { kind: 'unknown' };
  }

  private async lookupMtn(ref: string): Promise<PollLook> {
    try {
      const sent = await this.mtn.transferDeliveryNotification(ref);
      if (sent.statusCode === '404') return { kind: 'missing' };
      if (!sent.statusCode) return { kind: 'unknown' };
      return { kind: 'code', code: sent.statusCode };
    } catch (error: any) {
      return { kind: 'unknown' };
    }
  }

  /**
   * GET /api/v2/payment/:reference is FreemoPay's own reference.
   * A 404 is missing. A transport error or a blank status stays unknown.
   */
  private async lookupFreemopay(ref: string): Promise<PollLook> {
    try {
      const status = await this.freemopay.checkTransactionStatus(ref);
      const code = (status.status ?? '').trim();
      if (!code || code.toUpperCase() === 'UNKNOWN') return { kind: 'unknown' };
      return { kind: 'code', code };
    } catch (error: any) {
      const http = Number(error?.status ?? error?.response?.status ?? 0);
      if (http === 404) return { kind: 'missing' };
      return { kind: 'unknown' };
    }
  }

  private async lookupFedapay(ref: string): Promise<PollLook> {
    try {
      const status = await this.fedapay.checkPayoutStatus(ref);
      if (!status.status) return { kind: 'unknown' };
      return { kind: 'code', code: status.status };
    } catch (error: any) {
      return { kind: 'unknown' };
    }
  }

  private fromCode(provider: string, providerRef: string, code: string): MomoRefundResult {
    return { status: mapRefundPoll(code), provider, providerRef, unsupported: false };
  }

  private stableId(request: MomoRefundRequest): string {
    return request.referenceId?.trim() || this.externalId(request.bookingId);
  }

  private unsentResult(provider: string): MomoRefundResult {
    return { status: 'refund_pending', provider, providerRef: null, unsupported: false, unsent: true };
  }

  private pending(provider: string, providerRef: string | null, unsupported: boolean): MomoRefundResult {
    return { status: 'refund_pending', provider, providerRef, unsupported };
  }

  private failed(provider: string, providerRef: string | null): MomoRefundResult {
    return { status: 'failed', provider, providerRef, unsupported: false };
  }

  private externalId(bookingId: string): string {
    return `rental-decline-${bookingId}`;
  }

  private msisdn(phone: string | null): string {
    return (phone ?? '').replace(/\D/g, '');
  }

  private callbackUrl(provider: string): string {
    const base = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/rentals/refunds/${provider}/ignored`;
  }
}

type PollLook = { kind: 'code'; code: string } | { kind: 'missing' } | { kind: 'unknown' };
