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
}

export interface MomoRefundResult {
  status: RefundStatus;
  provider: string;
  providerRef: string | null;
  unsupported: boolean;
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
    if (!started.providerRef || started.status !== 'refund_pending') return started;
    return this.finishPoll(plan, started.providerRef);
  }

  async poll(provider: string, providerRef: string): Promise<RefundStatus> {
    const plan = providerRefundPlan(provider);
    if (plan === 'unsupported') return 'refund_pending';
    return mapRefundPoll(await this.pollCode(plan, providerRef));
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
      payee: { partyIdType: 'MSISDN', partyId: this.msisdn(request.phone) },
      payerMessage: 'Rental condition decline refund',
      payeeNote: request.bookingId,
    });
    const code = Number(sent.statusCode);
    if (!sent.status && code >= 400 && code < 500) {
      return this.failed('mtn', sent.financialTransactionId ?? null);
    }
    return this.pending('mtn', sent.financialTransactionId ?? null, false);
  }

  private async initiateFreemopay(request: MomoRefundRequest): Promise<MomoRefundResult> {
    const sent = await this.freemopay.withdraw({
      payee: this.msisdn(request.phone),
      amount: request.amount,
      externalId: this.externalId(request.bookingId),
      description: 'Rental condition decline refund',
      callback: this.callbackUrl('freemopay'),
    });
    if (!sent.success) return this.failed('freemopay', sent.reference ?? sent.transactionId ?? null);
    const ref = sent.reference || sent.transactionId || this.externalId(request.bookingId);
    return this.pending('freemopay', ref, false);
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

  private async finishPoll(plan: ProviderRefundPlan, ref: string): Promise<MomoRefundResult> {
    const status = mapRefundPoll(await this.pollCode(plan, ref));
    return { status, provider: plan, providerRef: ref, unsupported: false };
  }

  private async pollCode(plan: ProviderRefundPlan, ref: string): Promise<string | null> {
    try {
      if (plan === 'mtn') return (await this.mtn.transferDeliveryNotification(ref)).statusCode ?? null;
      if (plan === 'freemopay') return (await this.freemopay.checkTransactionStatus(ref)).status ?? null;
      if (plan === 'fedapay') return (await this.fedapay.checkPayoutStatus(ref)).status ?? null;
      return null;
    } catch (error: any) {
      return null;
    }
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
