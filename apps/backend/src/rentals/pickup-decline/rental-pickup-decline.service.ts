import { HttpException, HttpStatus, Inject, Injectable, Logger, OnModuleInit, Optional, forwardRef } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { DeliveryPinService } from '../../delivery-pin/delivery-pin.service';
import { withDeclineLock } from './decline-booking-lock';
import { REVERT_UNPAID_DECLINE } from './decline-revert';
import { beginFedapayListTick } from '../../mobile-payments/providers/fedapay.service';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { RbacService } from '../../rbac/rbac.service';
import { isActivePersona } from '../../users/persona.util';
import { INSERT_RENTAL_STATUS_HISTORY } from '../rentals-queries';
import { RentalInspectionFlags } from '../inspection/rental-inspection-flags.service';
import { rentalLedgerKey } from '../rental-ledger';
import { RentalsService } from '../rentals.service';
import { registerLateCollectRefund } from './late-collect-refund';
import { isDeclineEvidenceKey } from './pickup-decline.keys';
import {
  capRefund,
  claimStaleAt,
  declineRail,
  fedapayChannel,
  FEDAPAY_CONFIRM_MS,
  FEDAPAY_EXHAUSTED_POLL_MS,
  FEDAPAY_LIST_LAG_MS,
  FEDAPAY_UNKNOWN_NOTICE_AFTER,
  mapRefundPoll,
  providerRefundPlan,
  maskMomoPhone,
  moneyAmount,
  nextRefundAt,
  REFUND_ATTEMPT_LIMIT,
  refundSource,
  stableRefundReference,
  sumCollected,
  unknownRetryAt,
  type CollectedPayment,
  type DeclineRail,
  type RefundStatus,
} from './pickup-decline.money';
import {
  declineGuard,
  isDeclineReason,
  otherReasonText,
  refundMarkAllowed,
  refundMarkEvidence,
  refundOverrideAllowed,
  type DeclineReason,
} from './pickup-decline.policy';
import * as Q from './pickup-decline.queries';

const RENTER_NOTICE_TRIES = 3;
const MTN_RESEND_MIN_MS = 2 * 60 * 1000;
const MTN_OVERRIDE_LAG_MS = 10 * 60 * 1000;
import { RentalConditionPhotosService } from './rental-condition-photos.service';
import { RentalMomoRefundService, type FedapayExternalLook } from './rental-momo-refund.service';

type ExternalLook = FedapayExternalLook;

type ListFlags = {
  markedResend: boolean;
  trustEmptyList: boolean;
  settled: boolean;
  creditAged: boolean;
  limited: boolean;
};

export interface DeclineInput {
  versionId: string;
  reason: string;
  text?: string;
  photos?: string[];
}

export interface DeclineResult {
  success: true;
  idempotent: boolean;
  bookingId: string;
  status: 'cancelled';
  rail: DeclineRail;
  refundStatus: RefundStatus;
  amount: number;
  currency: string;
  phoneMask: string | null;
  reason: string;
  reasonText: string | null;
}

interface DeclineBooking {
  id: string;
  booking_number: string;
  status: string;
  payment_status: string | null;
  contract_expires_at: string | null;
  actual_start_at: string | null;
  inspection_policy_version: number | null;
  pickup_current_version_id: string | null;
  pickup_accepted_version_id?: string | null;
  condition_declined_at: string | null;
  refund_status: RefundStatus | null;
  refund_attempts?: number | null;
  refund_amount?: number | string | null;
  refund_provider: string | null;
  refund_provider_ref: string | null;
  refund_sent_at?: string | null;
  refund_send_attempted_at?: string | null;
  refund_next_at?: string | null;
  refund_list_empty_at?: string | null;
  refund_unknown_streak?: number | null;
  refund_unknown_notice_at?: string | null;
  refund_requested_at?: string | null;
  refund_claim_at?: string | null;
  refund_credited_at?: string | null;
  refund_claim_token?: string | null;
  refund_notices?: string[] | null;
  authorized_amount: number | string | null;
  total_amount: number | string | null;
  currency: string;
  client_id: string;
  business_id: string;
  client: { user_id: string; user?: { first_name?: string | null; last_name?: string | null } };
  business?: { user_id?: string | null } | null;
  rental_location_listing?: {
    business_location?: { address?: { country?: string | null } | null } | null;
    rental_item?: { name?: string | null } | null;
  } | null;
}

interface OverridePrior {
  attempts: number;
  nextAt: string | null;
  stamp: string | null;
}

interface DeclineRow {
  id: string;
  reason: string;
  reason_text: string | null;
  money_rail: DeclineRail;
  money_amount: number | string;
  money_currency: string | null;
  phone_mask: string | null;
  version_id?: string;
  effects_recorded_at?: string | null;
}

interface Ledger {
  rail: DeclineRail;
  amount: number;
  currency: string;
  phoneMask: string | null;
  phone: string | null;
  provider: string | null;
  collects: CollectedPayment[];
}

interface HeldPayout {
  booking: DeclineBooking;
  ledger: Ledger;
  source: CollectedPayment;
  token: string;
}

interface HeldDecline {
  result: DeclineResult;
  payout?: HeldPayout;
}

@Injectable()
export class RentalPickupDeclineService implements OnModuleInit {
  /** Empty FedaPay lists are untrusted until the send-attempt marker is this old. */
  static fedapayListLagMs = FEDAPAY_LIST_LAG_MS;
  /** Two provable-empty lists must be at least this far apart before a resend creates. */
  static fedapayConfirmMs = FEDAPAY_CONFIRM_MS;
  /** Unknown lookups before one manual-check notice. */
  static unknownNoticeAfter = FEDAPAY_UNKNOWN_NOTICE_AFTER;
  /** One cron pass shares the three FedaPay config reads. */
  private passConfig: { lagMs: number; confirmMs: number; noticeAfter: number } | null = null;
  private static readonly DECLINE_NOTE = 'Renter declined the pickup condition';
  private readonly logger = new Logger(RentalPickupDeclineService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly users: HasuraUserService,
    private readonly flags: RentalInspectionFlags,
    private readonly momo: RentalMomoRefundService,
    private readonly photos: RentalConditionPhotosService,
    private readonly notifications: NotificationsService,
    private readonly pins: DeliveryPinService,
    @Inject(forwardRef(() => RentalsService)) private readonly rentals: RentalsService,
    private readonly rbac: RbacService,
    @Optional() @Inject(DatabaseService) private readonly database?: DatabaseService
  ) {}

  onModuleInit(): void {
    registerLateCollectRefund((bookingId, extra) => this.refundLateCollect(bookingId, extra));
  }

  async decline(bookingId: string, input: DeclineInput): Promise<DeclineResult> {
    const user = await this.users.getUser();
    const held = await withDeclineLock(bookingId, this.database, () => this.declineHeld(user, bookingId, input));
    return this.payOutside(held);
  }

  /** Provider HTTP runs after the lock transaction commits. */
  private async payOutside(held: HeldDecline): Promise<DeclineResult> {
    if (!held.payout) return held.result;
    const refundStatus = await this.callProvider(held.payout.booking, held.payout.ledger, held.payout.source, held.payout.token);
    return { ...held.result, refundStatus };
  }

  private async declineHeld(user: { id: string; client?: { id?: string } }, bookingId: string, input: DeclineInput): Promise<HeldDecline> {
    const booking = await this.requireBooking(bookingId);
    await this.requireFlag(booking);
    this.requireRenter(user, booking);
    const stored = await this.findForBooking(booking.id);
    if (stored) return this.resume(booking, stored);
    this.requireOpen(booking, input.versionId);
    await this.requirePhotos(booking.id, input.photos ?? []);
    return this.cancelAndRecord(booking, user.id, input, this.reason(input));
  }

  async decorateBooking(booking: any): Promise<any> {
    if (!booking?.id || !(await this.flags.pickupDeclineEnabled(this.country(booking)))) return booking;
    await this.reconcileQuiet(booking);
    const row = await this.findForBooking(booking.id);
    if (!row) return { ...booking, condition_decline: null };
    const photos = await this.viewerPhotos(booking, row.id);
    return { ...booking, condition_decline: this.publicDecline(booking, row, photos) };
  }

  async reconcilePending(): Promise<number> {
    const updated = await this.reconcileDue();
    await this.retryRenterNotices();
    return updated;
  }

  private async reconcileDue(): Promise<number> {
    this.passConfig = null;
    const now = new Date();
    const result = await this.hasura.executeQuery<{ rental_bookings: DeclineBooking[] }>(Q.PENDING_REFUNDS, {
      now: now.toISOString(),
      stale: claimStaleAt(now.getTime()),
    });
    let updated = 0;
    for (const booking of result.rental_bookings ?? []) updated += await this.reconcileRow(booking);
    return updated;
  }

  async adminDetail(bookingId: string) {
    const booking = await this.requireBooking(bookingId);
    await this.requireFlag(booking);
    const row = await this.findForBooking(bookingId);
    if (!row) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    const photos = await this.photos.signedForDecline(row.id);
    return { decline: this.publicDecline(booking, row, photos) };
  }

  async markRefund(
    bookingId: string,
    body: { status: 'refunded' | 'failed' | 'unpaid' | 'manual_override'; providerRef?: string; note?: string }
  ): Promise<{ refundStatus: RefundStatus }> {
    await this.requireMarkPermission(body.status);
    const booking = await this.requireBooking(bookingId);
    await this.requireFlag(booking);
    this.requirePending(booking);
    if (!refundMarkEvidence(body.providerRef, body.note)) {
      throw new HttpException('Add the provider reference or a note', HttpStatus.BAD_REQUEST);
    }
    await this.applyMark(booking, body);
    const refundStatus: RefundStatus = body.status === 'refunded' ? 'refunded' : 'failed';
    return { refundStatus };
  }

  /** A later collect stays in the wallet when an earlier success already has a debit. */
  async refundLateCollect(bookingId: string, extra?: CollectedPayment): Promise<void> {
    const booking = await this.requireBooking(bookingId);
    if (!booking.condition_declined_at) return;
    if (booking.refund_status && booking.refund_status !== 'none') return;
    const ledger = await this.lateLedger(booking, extra);
    if (ledger.rail !== 'momo_paid') return;
    await this.consumeOrBusy(booking, ledger.amount);
    await this.refundCollected(booking, ledger, 'late_collect');
  }

  private async cancelAndRecord(
    booking: DeclineBooking,
    userId: string,
    input: DeclineInput,
    reason: { reason: DeclineReason; text: string | null }
  ): Promise<HeldDecline> {
    const ledger = await this.ledger(booking);
    const won = await this.claimCancel(booking, input.versionId);
    if (!won) return this.lost(booking, input.versionId);
    const saved = await this.rowOrRevert(booking, userId, input, reason, ledger);
    if (!saved.created) return this.resume(await this.requireBooking(booking.id), saved.row);
    await this.fundsOrRevert(booking, ledger, saved.row.id);
    await this.cancelPendingCollects(booking.booking_number);
    return this.finishRecorded(booking, userId, saved.row, input.photos ?? [], ledger);
  }

  private async rowOrRevert(
    booking: DeclineBooking,
    userId: string,
    input: DeclineInput,
    reason: { reason: DeclineReason; text: string | null },
    ledger: Ledger
  ): Promise<{ row: DeclineRow; created: boolean }> {
    try {
      return await this.insertDecline(booking, userId, input.versionId, reason, ledger);
    } catch (error: any) {
      if (await this.revertIfUnpaid(booking, null)) throw error;
      throw this.refundInProgress();
    }
  }

  private async fundsOrRevert(booking: DeclineBooking, ledger: Ledger, declineId: string): Promise<void> {
    try {
      await this.moveFunds(booking, ledger);
    } catch (error: any) {
      if (await this.revertIfUnpaid(booking, declineId)) throw error;
    }
  }

  /** True when the booking was restored. A debit or a payout leaves the cancel in place. */
  private async revertIfUnpaid(booking: DeclineBooking, declineId: string | null): Promise<boolean> {
    if (!this.database) throw this.refundInProgress();
    const rows = await this.database.query<{ id: string }>(REVERT_UNPAID_DECLINE, [
      rentalLedgerKey(booking.id, 'decline:refund'),
      booking.id,
      declineId,
      booking.status,
      booking.payment_status,
      booking.contract_expires_at,
    ]);
    return rows.length > 0;
  }

  /** A debit or a payout means the cancel stays, even when this request lost the ledger race. */
  private async moneyLanded(booking: DeclineBooking): Promise<boolean> {
    if (await this.payoutStarted(booking)) return true;
    return this.rentals.declineRefundDebited(booking.id);
  }

  private async payoutStarted(booking: DeclineBooking): Promise<boolean> {
    const fresh = await this.requireBooking(booking.id);
    if (fresh.refund_provider_ref || fresh.refund_sent_at) return true;
    return Boolean(fresh.refund_status && fresh.refund_status !== 'none');
  }

  private async consumeOrBusy(booking: DeclineBooking, amount: number): Promise<void> {
    try {
      await this.rentals.consumeDeclineHold(booking, amount);
    } catch (error: any) {
      if (await this.moneyLanded(booking)) return;
      if (!this.fundsShort(error)) throw error;
      throw this.refundInProgress();
    }
  }

  private fundsShort(error: any): boolean {
    const body = typeof error?.getResponse === 'function' ? error.getResponse() : error?.response;
    const detail = typeof body === 'string' ? body : body?.message ?? body?.error ?? '';
    return `${error?.message ?? ''} ${detail}`.toLowerCase().includes('insufficient funds');
  }

  private refundInProgress(): HttpException {
    return new HttpException(
      { message: 'refund already in progress', code: 'REFUND_IN_PROGRESS' },
      HttpStatus.CONFLICT
    );
  }

  private async finishRecorded(
    booking: DeclineBooking,
    userId: string,
    row: DeclineRow,
    photos: string[],
    ledger: Ledger
  ): Promise<HeldDecline> {
    const opened = await this.openRefund(booking, ledger);
    await this.afterOnce(booking, userId, row, photos);
    return { result: this.toResult(booking, row, ledger, opened.status, false), payout: opened.payout };
  }

  private async moveFunds(booking: DeclineBooking, ledger: Ledger): Promise<void> {
    if (ledger.rail === 'momo_paid') {
      await this.consumeOrBusy(booking, ledger.amount);
    } else {
      await this.rentals.releaseFreeCancelFunds(booking);
    }
    // Not as described: a paid reservation fee always comes back (card, or the wallet).
    await this.rentals.refundReservationFeeFor?.(booking.id, 'not_as_described');
  }

  private async resume(booking: DeclineBooking, row: DeclineRow): Promise<HeldDecline> {
    if (row.money_rail === 'momo_paid' && this.kept(booking) === 'none') return this.resumePayout(booking, row);
    if (row.effects_recorded_at === null) await this.afterOnce(booking, booking.client.user_id, row, []);
    const result = this.toResult(booking, row, this.storedLedger(booking, row), this.kept(booking), true);
    return { result };
  }

  /** Debit and claim under the lock. The provider call happens after the lock commits. */
  private async resumePayout(booking: DeclineBooking, row: DeclineRow): Promise<HeldDecline> {
    const ledger = this.capLedger(await this.ledger(booking), moneyAmount(row.money_amount));
    await this.consumeOrBusy(booking, ledger.amount);
    const opened = await this.claimPayout(booking, ledger);
    await this.afterOnce(booking, booking.client.user_id, row, []);
    return { result: this.toResult(booking, row, ledger, opened.status, true), payout: opened.payout };
  }

  private storedLedger(booking: DeclineBooking, row: DeclineRow): Ledger {
    return {
      rail: row.money_rail,
      amount: moneyAmount(row.money_amount),
      currency: row.money_currency ?? booking.currency,
      phoneMask: row.phone_mask,
      phone: null,
      provider: null,
      collects: [],
    };
  }

  private async openRefund(booking: DeclineBooking, ledger: Ledger): Promise<{ status: RefundStatus; payout?: HeldPayout }> {
    if (ledger.rail !== 'momo_paid') return { status: 'none' };
    if (booking.refund_status && booking.refund_status !== 'none') return { status: booking.refund_status };
    return this.claimPayout(booking, ledger);
  }

  private async refundCollected(booking: DeclineBooking, ledger: Ledger, notice?: string): Promise<RefundStatus> {
    const opened = await this.claimPayout(booking, ledger, notice);
    if (!opened.payout) return opened.status;
    return this.callProvider(opened.payout.booking, opened.payout.ledger, opened.payout.source, opened.payout.token);
  }

  private async claimPayout(
    booking: DeclineBooking,
    ledger: Ledger,
    notice?: string
  ): Promise<{ status: RefundStatus; payout?: HeldPayout }> {
    const source = refundSource(ledger.collects, booking.currency);
    if (!source) return { status: await this.unsupported(booking, ledger) };
    const token = await this.claimRefund(booking.id, ledger, source.provider);
    if (!token) return { status: await this.currentRefund(booking.id) };
    if (notice) await this.tellSupport(booking, notice);
    return { status: 'refund_pending', payout: { booking, ledger, source, token } };
  }

  private async callProvider(
    booking: DeclineBooking,
    ledger: Ledger,
    source: CollectedPayment,
    token: string
  ): Promise<RefundStatus> {
    const referenceId = booking.refund_provider_ref ?? stableRefundReference(booking.id);
    if (!(await this.keepClaim(booking.id, token))) return 'refund_pending';
    return this.sendOwned(booking, ledger, source, referenceId, token);
  }

  private ownedRefund(
    booking: DeclineBooking,
    ledger: Ledger,
    source: CollectedPayment,
    referenceId: string,
    flags: { markedResend: boolean; trustEmptyList: boolean; settled?: boolean; creditAged?: boolean },
    token: string
  ) {
    return {
      ...this.refundRequest(booking, ledger, source, referenceId, flags),
      beforeProviderSend: () => this.noteSendStart(booking, token),
    };
  }

  private refundRequest(
    booking: DeclineBooking,
    ledger: Ledger,
    source: CollectedPayment,
    referenceId: string,
    flags: { markedResend: boolean; trustEmptyList: boolean; settled?: boolean; creditAged?: boolean }
  ) {
    return {
      bookingId: booking.id,
      amount: this.payoutAmount(booking, ledger.amount),
      currency: booking.currency,
      provider: source.provider,
      phone: source.phone,
      transactionId: source.transactionId,
      channel: fedapayChannel(source.phone, source.channel),
      referenceId,
      markedResend: flags.markedResend,
      trustEmptyList: flags.trustEmptyList,
      creditAged: flags.creditAged === true,
    };
  }

  private async sendOwned(
    booking: DeclineBooking,
    ledger: Ledger,
    source: CollectedPayment,
    referenceId: string,
    token: string
  ): Promise<RefundStatus> {
    try {
      this.beginListTick(booking);
      const flags = await this.listFlags(booking, token);
      if (flags.limited) return this.noteLimited(booking, token);
      if (!(await this.markAttempt(booking, token))) return 'refund_pending';
      if (!(await this.markSent(booking, source.provider, token))) return 'refund_pending';
      const result = await this.momo.refund(this.ownedRefund(booking, ledger, source, referenceId, flags, token));
      if (result.unsent) return this.dropUnsent(booking, token, referenceId, Boolean(result.connectFailure));
      await this.stampMtn(booking, source.provider, token, result.status);
      if (result.limited) return this.noteHeld(booking, token);
      await this.noteLastSend(booking, token, result);
      await this.finishLookup(booking, token, result.blankRef === true, flags.settled);
      return this.settleResult(booking, ledger, result, referenceId, token);
    } catch (error: any) {
      this.logger.warn(`decline payout: ${error?.message ?? error}`);
      return 'refund_pending';
    }
  }

  private async settleResult(
    booking: DeclineBooking,
    ledger: Ledger,
    result: { status: RefundStatus; provider: string; providerRef: string | null; unsupported: boolean; unsent?: boolean; blankRef?: boolean },
    referenceId: string,
    token: string
  ): Promise<RefundStatus> {
    if (result.unsupported) return this.holdUnsupported(booking, ledger, token);
    if (result.status === 'failed') return this.failOwned(booking, ledger.amount, result.providerRef ?? referenceId, token);
    const ref = result.blankRef ? null : (result.providerRef ?? referenceId);
    const wrote = await this.writeOwned(booking.id, token, result.status, result.provider, ref);
    if (!wrote && ref) await this.keepProviderRef(booking.id, referenceId, ref);
    if (wrote && result.status === 'refunded') await this.tellRenter(booking, 'sent');
    return wrote ? result.status : 'refund_pending';
  }

  private async holdUnsupported(booking: DeclineBooking, ledger: Ledger, token: string): Promise<RefundStatus> {
    if (!(await this.keepClaim(booking.id, token))) return 'refund_pending';
    await this.rentals.restoreDeclinePayout(booking, ledger.amount);
    await this.markCredited(booking.id);
    await this.tellRenter(booking, 'wallet');
    const wrote = await this.writeOwned(booking.id, token, 'manual', 'unsupported', null);
    if (wrote) await this.tellSupport(booking, 'unsupported');
    return wrote ? 'manual' : 'refund_pending';
  }

  private async claimCancel(booking: DeclineBooking, versionId: string): Promise<boolean> {
    const result = await this.hasura.executeMutation<{ update_rental_bookings?: { affected_rows: number } }>(
      Q.DECLINE_CANCEL,
      {
        id: booking.id,
        from: [booking.status],
        versionId,
        set: {
          status: 'cancelled',
          payment_status: 'cancelled',
          contract_expires_at: null,
          condition_declined_at: new Date().toISOString(),
        },
      }
    );
    return (result.update_rental_bookings?.affected_rows ?? 0) === 1;
  }

  private async cancelPendingCollects(bookingNumber: string): Promise<void> {
    if (!bookingNumber) return;
    await this.hasura.executeMutation(Q.CANCEL_PENDING_COLLECTS, { bookingNumber });
  }

  private async lost(booking: DeclineBooking, versionId: string): Promise<HeldDecline> {
    const fresh = await this.requireBooking(booking.id);
    const row = await this.find(booking.id, versionId);
    if (fresh.condition_declined_at && row) return this.resume(fresh, row);
    throw new HttpException('Booking status changed', HttpStatus.CONFLICT);
  }

  private async ledger(booking: DeclineBooking): Promise<Ledger> {
    const collects = await this.collects(booking.booking_number, booking.currency);
    const collected = sumCollected(collects, booking.currency);
    const hold = await this.holdAmount(booking.id);
    const rail = declineRail({
      collected,
      authorizedAmount: moneyAmount(booking.authorized_amount),
      walletHold: hold,
    });
    return this.ledgerFor(booking, collects, rail, collected, hold);
  }

  private ledgerFor(
    booking: DeclineBooking,
    collects: CollectedPayment[],
    rail: DeclineRail,
    collected: number,
    hold: number
  ): Ledger {
    const source = refundSource(collects, booking.currency);
    const amount = this.displayAmount(rail, booking, collected, hold);
    if (rail === 'momo_paid' && amount > collected) {
      throw new HttpException('Refund exceeds what was collected', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return {
      rail,
      amount,
      currency: booking.currency,
      phoneMask: source ? maskMomoPhone(source.phone) : null,
      phone: source?.phone ?? null,
      provider: source?.provider ?? null,
      collects,
    };
  }

  private displayAmount(rail: DeclineRail, booking: DeclineBooking, collected: number, hold: number): number {
    if (rail === 'momo_paid') return capRefund(collected, collected);
    if (rail === 'card') return moneyAmount(booking.authorized_amount);
    if (rail === 'wallet') return hold;
    return 0;
  }

  private async collects(bookingNumber: string, currency: string): Promise<CollectedPayment[]> {
    if (!bookingNumber) return [];
    const result = await this.hasura.executeQuery<{
      mobile_payment_transactions: Array<Record<string, unknown>>;
    }>(Q.DECLINE_COLLECTS, { bookingNumber });
    return (result.mobile_payment_transactions ?? []).map((row) => ({
      amount: moneyAmount(row.amount),
      currency: String(row.currency ?? currency),
      provider: String(row.provider ?? ''),
      phone: row.customer_phone ? String(row.customer_phone) : null,
      transactionId: row.transaction_id ? String(row.transaction_id) : null,
      channel: row.payment_method ? String(row.payment_method) : null,
    }));
  }

  private async holdAmount(bookingId: string): Promise<number> {
    const result = await this.hasura.executeQuery<{
      rental_holds: Array<{ client_hold_amount: unknown; status: string }>;
    }>(Q.DECLINE_HOLD, { bookingId });
    const active = (result.rental_holds ?? []).find((row) => row.status === 'active');
    return active ? moneyAmount(active.client_hold_amount) : 0;
  }

  private async insertDecline(
    booking: DeclineBooking,
    userId: string,
    versionId: string,
    reason: { reason: DeclineReason; text: string | null },
    ledger: Ledger
  ): Promise<{ row: DeclineRow; created: boolean }> {
    const object = this.declineObject(booking, userId, versionId, reason, ledger);
    try {
      const inserted = await this.hasura.executeMutation<{
        insert_rental_condition_declines_one: { id: string } | null;
      }>(Q.INSERT_DECLINE, { object });
      const id = inserted.insert_rental_condition_declines_one?.id;
      if (id) return { row: { id, ...object, effects_recorded_at: null } as DeclineRow, created: true };
    } catch (error: any) {
      const found = await this.findForBooking(booking.id);
      if (found) return { row: found, created: false };
      throw error;
    }
    const found = await this.findForBooking(booking.id);
    if (!found) throw new HttpException('Could not record the decline', HttpStatus.INTERNAL_SERVER_ERROR);
    return { row: found, created: false };
  }

  private declineObject(
    booking: DeclineBooking,
    userId: string,
    versionId: string,
    reason: { reason: DeclineReason; text: string | null },
    ledger: Ledger
  ) {
    return {
      rental_booking_id: booking.id,
      version_id: versionId,
      reason: reason.reason,
      reason_text: reason.text,
      money_rail: ledger.rail,
      money_amount: ledger.amount,
      money_currency: ledger.currency,
      phone_mask: ledger.phoneMask,
      declined_by_user_id: userId,
    };
  }

  private async claimRefund(bookingId: string, ledger: Ledger, provider: string): Promise<string | null> {
    const now = new Date();
    const token = randomUUID();
    const result = await this.hasura.executeMutation<{ update_rental_bookings?: { affected_rows: number } }>(
      Q.STAMP_REFUND,
      { id: bookingId, set: this.refundStamp(ledger, provider, token, now) }
    );
    return (result.update_rental_bookings?.affected_rows ?? 0) === 1 ? token : null;
  }

  private refundStamp(ledger: Ledger, provider: string, token: string, now: Date) {
    const at = now.toISOString();
    return {
      refund_status: 'refund_pending',
      refund_requested_at: at,
      refund_status_at: at,
      refund_amount: ledger.amount,
      refund_currency: ledger.currency,
      refund_provider: provider,
      refund_attempts: 1,
      refund_claim_at: at,
      refund_claim_token: token,
      refund_next_at: nextRefundAt(1, now.getTime()),
    };
  }

  /** One committed update before the POST, on every rail. A failed write does not send. */
  private async markAttempt(booking: DeclineBooking, token: string): Promise<boolean> {
    if (booking.refund_send_attempted_at) return true;
    const at = new Date().toISOString();
    try {
      if (!(await this.writeAttempt(booking.id, token, at))) return false;
      booking.refund_send_attempted_at = at;
      return true;
    } catch (error: any) {
      void error;
      return false;
    }
  }

  /** The lag stamp moves before create and sendNow, so a lost reply still counts. */
  private async noteSendStart(booking: DeclineBooking, token: string): Promise<boolean> {
    const at = new Date().toISOString();
    try {
      if (!(await this.bumpAttempt(booking.id, token, at))) return false;
      booking.refund_send_attempted_at = at;
      return true;
    } catch (error: any) {
      this.logger.warn(`decline send stamp: ${error?.message ?? error}`);
      return false;
    }
  }

  /** A create or sendNow moves the lag stamp. The first write stays the one-time marker. */
  private async noteLastSend(
    booking: DeclineBooking,
    token: string,
    result: { status: string; providerRef: string | null; unsupported: boolean; unsent?: boolean; blankRef?: boolean; limited?: boolean }
  ): Promise<void> {
    if (!this.openedPayout(result)) return;
    const at = new Date().toISOString();
    try {
      if (!(await this.bumpAttempt(booking.id, token, at))) return;
      booking.refund_send_attempted_at = at;
    } catch (error: any) {
      this.logger.warn(`decline send stamp: ${error?.message ?? error}`);
    }
  }

  private openedPayout(result: { status: string; providerRef: string | null; unsupported: boolean; unsent?: boolean; blankRef?: boolean; limited?: boolean }): boolean {
    if (result.unsent || result.blankRef || result.unsupported || result.limited) return false;
    return Boolean(result.providerRef) && result.status !== 'failed';
  }

  private async bumpAttempt(id: string, token: string, at: string): Promise<boolean> {
    const result = await this.hasura.executeMutation<{ update_rental_bookings?: { affected_rows: number } }>(
      Q.BUMP_SEND_ATTEMPT,
      { id, token, at }
    );
    return (result.update_rental_bookings?.affected_rows ?? 0) === 1;
  }

  private async writeAttempt(id: string, token: string, at: string): Promise<boolean> {
    const result = await this.hasura.executeMutation<{ update_rental_bookings?: { affected_rows: number } }>(
      Q.STAMP_ATTEMPT,
      { id, token, at }
    );
    return (result.update_rental_bookings?.affected_rows ?? 0) === 1;
  }

  private async dropUnsent(booking: DeclineBooking, token: string, referenceId: string, connectFailure: boolean): Promise<RefundStatus> {
    await this.clearUnsent(booking.id, token, referenceId);
    if (!connectFailure) return 'refund_pending';
    await this.clearAttempt(booking.id, token);
    booking.refund_send_attempted_at = null;
    return 'refund_pending';
  }

  private async clearAttempt(id: string, token: string): Promise<void> {
    await this.hasura.executeMutation(Q.CLEAR_ATTEMPT, { id, token });
  }

  /** FreemoPay writes the stable id and the sent stamp together, immediately before the withdrawal. */
  private async markSent(booking: DeclineBooking, provider: string, token: string): Promise<boolean> {
    if (providerRefundPlan(provider) !== 'freemopay') return true;
    const ref = stableRefundReference(booking.id);
    try {
      const wrote = await this.writeSent(booking, token, provider, ref);
      if (!wrote) await this.clearUnsent(booking.id, token, ref);
      return wrote;
    } catch (error: any) {
      void error;
      await this.clearUnsent(booking.id, token, ref);
      return false;
    }
  }

  /** MTN stamps the same stable id only after the transfer is accepted. */
  private async stampMtn(booking: DeclineBooking, provider: string, token: string, status: RefundStatus): Promise<void> {
    if (providerRefundPlan(provider) !== 'mtn' || status !== 'refund_pending') return;
    try {
      await this.writeSent(booking, token, provider, stableRefundReference(booking.id));
    } catch (error: any) {
      void error;
    }
  }

  private async writeSent(booking: DeclineBooking, token: string, provider: string, ref: string): Promise<boolean> {
    const at = new Date().toISOString();
    const result = await this.hasura.executeMutation<{ update_rental_bookings?: { affected_rows: number } }>(
      Q.STAMP_SENT,
      { id: booking.id, token, provider, ref, at }
    );
    if ((result.update_rental_bookings?.affected_rows ?? 0) !== 1) return false;
    booking.refund_sent_at = at;
    booking.refund_provider_ref = ref;
    return true;
  }

  private async clearSent(id: string, token: string): Promise<void> {
    await this.hasura.executeMutation(Q.CLEAR_SENT, { id, token });
  }

  /** A connect failure never left us. Drop the stable id so the next claim can send it, not a 404. */
  private async clearUnsent(id: string, token: string, stableRef: string): Promise<void> {
    await this.clearSent(id, token);
    await this.hasura.executeMutation(Q.CLEAR_STABLE_REF, { id, token, stableRef });
  }

  private async markCredited(id: string): Promise<void> {
    try {
      await this.hasura.executeMutation(Q.MARK_CREDITED, { id, at: new Date().toISOString() });
    } catch (error: any) {
      this.logger.warn(`decline credit stamp: ${error?.message ?? error}`);
    }
  }

  private async keepProviderRef(bookingId: string, stableRef: string, providerRef: string): Promise<void> {
    if (!providerRef || providerRef === stableRef) return;
    await this.hasura.executeMutation(Q.KEEP_PROVIDER_REF, { id: bookingId, stableRef, ref: providerRef });
  }

  /** A new collect is not added to a payout that already has earlier successes. */
  private async lateLedger(booking: DeclineBooking, extra?: CollectedPayment): Promise<Ledger> {
    const base = await this.ledger(booking);
    if (this.extraStaysInWallet(base, extra)) return base;
    return this.includeCollect(base, extra);
  }

  private extraStaysInWallet(ledger: Ledger, extra?: CollectedPayment): boolean {
    if (!extra || moneyAmount(extra.amount) <= 0) return false;
    if (ledger.rail !== 'momo_paid') return false;
    return !this.hasCollect(ledger, extra);
  }

  /** Do not phone-pay more than the debit recorded when the refund was claimed. */
  private payoutAmount(booking: DeclineBooking, requested: number): number {
    const asked = moneyAmount(requested);
    const claimed = moneyAmount(booking.refund_amount);
    if (claimed > 0 && asked > claimed) return claimed;
    return asked;
  }

  private capLedger(ledger: Ledger, limit: number): Ledger {
    const cap = moneyAmount(limit);
    if (cap <= 0 || ledger.amount <= cap) return ledger;
    return { ...ledger, amount: cap };
  }

  private includeCollect(ledger: Ledger, extra?: CollectedPayment): Ledger {
    if (!extra || moneyAmount(extra.amount) <= 0 || this.hasCollect(ledger, extra)) return ledger;
    const collects = [...ledger.collects, extra];
    const collected = sumCollected(collects, ledger.currency);
    const source = refundSource(collects, ledger.currency);
    return {
      ...ledger,
      rail: declineRail({ collected, authorizedAmount: 0, walletHold: 0 }),
      amount: capRefund(collected, collected),
      phone: source?.phone ?? ledger.phone,
      phoneMask: source ? maskMomoPhone(source.phone) : ledger.phoneMask,
      provider: source?.provider ?? ledger.provider,
      collects,
    };
  }

  private hasCollect(ledger: Ledger, extra: CollectedPayment): boolean {
    return ledger.collects.some((row) => row.transactionId && row.transactionId === extra.transactionId);
  }

  private async writeOwned(
    bookingId: string,
    token: string,
    status: RefundStatus,
    provider: string,
    providerRef: string | null
  ): Promise<boolean> {
    const result = await this.hasura.executeMutation<{ update_rental_bookings?: { affected_rows: number } }>(
      Q.APPLY_OWNED_REFUND,
      { id: bookingId, token, set: this.ownedSet(status, provider, providerRef) }
    );
    return (result.update_rental_bookings?.affected_rows ?? 0) === 1;
  }

  private ownedSet(status: RefundStatus, provider: string, providerRef: string | null) {
    const now = new Date().toISOString();
    return {
      refund_status: status,
      refund_status_at: now,
      refund_provider: provider,
      ...(providerRef ? { refund_provider_ref: providerRef } : {}),
      refunded_at: status === 'refunded' ? now : null,
      refund_claim_at: null,
      refund_claim_token: null,
      ...(this.clearStreakOnWrite(status, providerRef) ? { refund_unknown_streak: 0 } : {}),
    };
  }

  /** A blank pending write is still an unknown. A match or a final status clears the streak. */
  private clearStreakOnWrite(status: RefundStatus, providerRef: string | null): boolean {
    return status !== 'refund_pending' || Boolean(providerRef);
  }

  private async unsupported(booking: DeclineBooking, ledger: Ledger): Promise<RefundStatus> {
    const token = await this.claimRefund(booking.id, ledger, 'unsupported');
    if (!token) return this.currentRefund(booking.id);
    return this.holdUnsupported(booking, ledger, token);
  }

  private async currentRefund(bookingId: string): Promise<RefundStatus> {
    const fresh = await this.requireBooking(bookingId);
    return fresh.refund_status ?? 'refund_pending';
  }

  private async afterOnce(booking: DeclineBooking, userId: string, row: DeclineRow, photos: string[]): Promise<void> {
    if (row.effects_recorded_at) return;
    if (!(await this.claimEffects(row))) return;
    try {
      await this.applyEffects(booking, userId, row.id, photos);
    } catch (error: any) {
      await this.clearEffects(row);
      this.logger.warn(`decline side effects: ${error?.message ?? error}`);
    }
  }

  private async applyEffects(booking: DeclineBooking, userId: string, declineId: string, photos: string[]): Promise<void> {
    if (photos.length > 0) await this.hasura.executeMutation(Q.LINK_PHOTOS, { ids: photos, bookingId: booking.id, declineId });
    await this.historyOnce(booking, userId);
    await this.pins.clearPinForOrder(booking.id);
    await this.notifyBusiness(booking);
  }

  private historyRow(booking: DeclineBooking, userId: string) {
    return {
      rental_booking_id: booking.id,
      status: 'cancelled',
      previous_status: booking.status,
      changed_by_user_id: userId,
      changed_by_type: 'client',
      notes: RentalPickupDeclineService.DECLINE_NOTE,
    };
  }

  private async claimEffects(row: DeclineRow): Promise<boolean> {
    const at = new Date().toISOString();
    const result = await this.hasura.executeMutation<{ update_rental_condition_declines?: { affected_rows: number } }>(
      Q.CLAIM_EFFECTS,
      { id: row.id, at }
    );
    if ((result.update_rental_condition_declines?.affected_rows ?? 0) !== 1) return false;
    row.effects_recorded_at = at;
    return true;
  }

  private async clearEffects(row: DeclineRow): Promise<void> {
    await this.hasura.executeMutation(Q.CLEAR_EFFECTS, { id: row.id });
    row.effects_recorded_at = null;
  }

  private async historyOnce(booking: DeclineBooking, userId: string): Promise<void> {
    if (await this.historyExists(booking.id)) return;
    try {
      await this.hasura.executeMutation(INSERT_RENTAL_STATUS_HISTORY, { object: this.historyRow(booking, userId) });
    } catch (error: any) {
      if (this.duplicateHistory(error)) return;
      throw error;
    }
  }

  private async historyExists(bookingId: string): Promise<boolean> {
    const result = await this.hasura.executeQuery<{ rental_status_history: Array<{ id: string }> }>(Q.DECLINE_HISTORY, {
      bookingId,
      notes: RentalPickupDeclineService.DECLINE_NOTE,
    });
    return (result.rental_status_history ?? []).length > 0;
  }

  private duplicateHistory(error: any): boolean {
    const message = String(error?.message ?? error);
    return message.includes('rental_status_history_one_decline') || message.includes('Uniqueness violation');
  }

  private async notifyBusiness(booking: DeclineBooking): Promise<void> {
    const userId = booking.business?.user_id;
    if (!userId) return;
    const renter = booking.client?.user;
    const name = [renter?.first_name, renter?.last_name].filter(Boolean).join(' ') || 'The renter';
    await this.notifications.sendConditionDeclinedNotice({
      businessUserId: userId,
      renterName: name,
      rentalItemName: booking.rental_location_listing?.rental_item?.name || 'the item',
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
    });
  }

  private async tellSupport(booking: DeclineBooking, outcome: string): Promise<void> {
    try {
      await this.sendNotice(booking, outcome);
    } catch (error: any) {
      this.logger.warn(`decline notice: ${error?.message ?? error}`);
      await this.releaseNotice(booking.id, outcome);
    }
  }

  private async sendNotice(booking: DeclineBooking, outcome: string): Promise<void> {
    if (!(await this.claimNotice(booking.id, outcome))) return;
    const sent = await this.notifications.notifySupportConditionRefund(this.noticeBody(booking, outcome));
    if (!sent) await this.releaseNotice(booking.id, outcome);
  }

  /** Once per booking. A failed send releases the claim so the next landing can retry. */
  private async tellRenter(booking: DeclineBooking, landed: 'wallet' | 'sent'): Promise<void> {
    try {
      await this.sendRenterNotice(booking, landed);
    } catch (error: any) {
      this.logger.warn(`decline renter notice: ${error?.message ?? error}`);
      await this.releaseNotice(booking.id, 'renter_landed');
    }
  }

  private async sendRenterNotice(booking: DeclineBooking, landed: 'wallet' | 'sent'): Promise<void> {
    const userId = booking.client?.user_id;
    const amount = moneyAmount(booking.refund_amount) || moneyAmount(booking.total_amount);
    if (!userId || amount <= 0 || this.alreadyTold(booking)) return;
    if (!(await this.claimTry(booking)) || !(await this.claimNotice(booking.id, 'renter_landed'))) return;
    const sent = await this.notifications.notifyRenterConditionRefund(this.renterBody(booking, userId, amount, landed));
    if (!sent) await this.releaseNotice(booking.id, 'renter_landed');
    if (sent) this.rememberNotice(booking, 'renter_landed');
  }

  /** Three tries. A failed send keeps the try and releases the landed claim so the cron can retry. */
  private async claimTry(booking: DeclineBooking): Promise<boolean> {
    const next = this.tryCount(booking) + 1;
    if (next > RENTER_NOTICE_TRIES) return false;
    const claimed = await this.claimNotice(booking.id, `renter_try:${next}`);
    if (claimed) this.rememberNotice(booking, `renter_try:${next}`);
    return claimed;
  }

  private alreadyTold(booking: DeclineBooking): boolean {
    return (booking.refund_notices ?? []).includes('renter_landed');
  }

  private tryCount(booking: DeclineBooking): number {
    const notices = booking.refund_notices ?? [];
    return [1, 2, 3].filter((n) => notices.includes(`renter_try:${n}`)).length;
  }

  private rememberNotice(booking: DeclineBooking, outcome: string): void {
    const notices = booking.refund_notices ?? [];
    if (!notices.includes(outcome)) booking.refund_notices = [...notices, outcome];
  }

  private async retryRenterNotices(): Promise<void> {
    try {
      const result = await this.hasura.executeQuery<{ rental_bookings: DeclineBooking[] }>(Q.RENTER_NOTICE_RETRIES, {
        landed: ['renter_landed'],
        try1: ['renter_try:1'],
        try2: ['renter_try:2'],
        try3: ['renter_try:3'],
      });
      for (const booking of result.rental_bookings ?? []) await this.retryOneNotice(booking);
    } catch (error: any) {
      this.logger.warn(`decline renter retry: ${error?.message ?? error}`);
    }
  }

  private async retryOneNotice(booking: DeclineBooking): Promise<void> {
    if (this.tryCount(booking) >= RENTER_NOTICE_TRIES) return;
    const wallet = Boolean(booking.refund_credited_at) || booking.refund_status !== 'refunded';
    await this.tellRenter(booking, wallet ? 'wallet' : 'sent');
  }

  private renterBody(booking: DeclineBooking, clientUserId: string, amount: number, landed: 'wallet' | 'sent') {
    return { clientUserId, bookingId: booking.id, amount, currency: booking.currency, landed };
  }

  private async claimNotice(id: string, outcome: string): Promise<boolean> {
    const claimed = await this.hasura.executeMutation<{ update_rental_bookings?: { affected_rows: number } }>(
      Q.CLAIM_NOTICE,
      { id, outcome: [outcome] }
    );
    return (claimed.update_rental_bookings?.affected_rows ?? 0) === 1;
  }

  private noticeBody(booking: DeclineBooking, outcome: string) {
    return {
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
      rentalItemName: booking.rental_location_listing?.rental_item?.name || 'the item',
      outcome,
      externalId: booking.refund_provider_ref || stableRefundReference(booking.id),
      walletCredited: outcome === 'failed' || outcome === 'unsupported',
    };
  }

  private async releaseNotice(id: string, outcome: string): Promise<void> {
    try {
      await this.hasura.executeMutation(Q.RELEASE_NOTICE, { id, outcome });
    } catch (error: any) {
      this.logger.warn(`decline notice release: ${error?.message ?? error}`);
    }
  }

  private async requirePhotos(bookingId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const result = await this.hasura.executeQuery<{
      rental_condition_decline_photos: Array<{ object_key: string; status: string; decline_id: string | null }>;
    }>(Q.READY_PHOTOS, { ids, bookingId });
    const rows = result.rental_condition_decline_photos ?? [];
    const ready = rows.filter(
      (row) => row.status === 'ready' && !row.decline_id && isDeclineEvidenceKey(row.object_key, bookingId)
    );
    if (ready.length !== ids.length) throw new HttpException('Photo is not ready', HttpStatus.BAD_REQUEST);
  }

  private async reconcileQuiet(booking: { refund_status?: string; refund_provider_ref?: string | null }): Promise<void> {
    if (booking.refund_status !== 'refund_pending' || !booking.refund_provider_ref) return;
    try {
      await this.reconcileOne(booking as DeclineBooking);
    } catch (error: any) {
      void error;
    }
  }

  private async reconcileOne(booking: DeclineBooking): Promise<boolean> {
    const attempts = booking.refund_attempts ?? 0;
    const token = randomUUID();
    if (!(await this.claimWork(booking, attempts, token))) return false;
    const claimed = { ...booking, refund_attempts: attempts + 1, refund_claim_token: token };
    if (this.hasProviderRef(claimed)) return this.pollClaimed(claimed, token);
    if (attempts < REFUND_ATTEMPT_LIMIT && this.needsSend(claimed)) return this.sendClaimed(claimed, token);
    return this.pollClaimed(claimed, token);
  }

  /** A stored reference may already be a payout. Probe it before any resend. */
  private hasProviderRef(booking: DeclineBooking): boolean {
    return Boolean((booking.refund_provider_ref ?? '').trim());
  }

  /** Send only when this booking has no provider reference and no sent stamp. */
  private needsSend(booking: DeclineBooking): boolean {
    return !this.hasProviderRef(booking) && !booking.refund_sent_at;
  }

  private async claimWork(booking: DeclineBooking, attempts: number, token: string): Promise<boolean> {
    const now = new Date();
    const result = await this.hasura.executeMutation<{ update_rental_bookings?: { affected_rows: number } }>(
      Q.CLAIM_REFUND,
      { id: booking.id, attempts, stale: claimStaleAt(now.getTime()), set: this.claimSet(attempts, now, token) }
    );
    return (result.update_rental_bookings?.affected_rows ?? 0) === 1;
  }

  private claimSet(attempts: number, now: Date, token: string) {
    const next = attempts + 1;
    return {
      refund_attempts: next,
      refund_claim_at: now.toISOString(),
      refund_claim_token: token,
      refund_next_at: nextRefundAt(next, now.getTime()),
    };
  }

  private async sendClaimed(booking: DeclineBooking, token: string): Promise<boolean> {
    if (!(await this.keepClaim(booking.id, token))) return false;
    const ledger = await this.ledger(booking);
    const source = refundSource(ledger.collects, booking.currency);
    const status = source ? await this.callProvider(booking, ledger, source, token) : 'refund_pending';
    if (status === 'refund_pending') await this.tellIfExhausted(booking);
    return status === 'refunded' || status === 'failed';
  }

  private async pollClaimed(booking: DeclineBooking, token: string): Promise<boolean> {
    if (!(await this.keepClaim(booking.id, token))) return false;
    if (!this.hasProviderRef(booking) && providerRefundPlan(booking.refund_provider ?? '') === 'fedapay') {
      return this.pollFedapayExternal(booking, token);
    }
    const ref = booking.refund_provider_ref ?? '';
    const probed = await this.momo.probe(booking.refund_provider ?? '', ref);
    if (probed === 'refunded') return this.markOwned(booking, token, 'refunded', ref);
    if (probed === 'failed') return this.failOwned(booking, this.refundPay(booking), ref, token).then((s) => s === 'failed');
    if (this.resendMtn(booking, probed)) return this.sendClaimed(booking, token);
    if (probed === 'missing' || probed === 'unknown') await this.tellSupport(booking, 'manual_check');
    await this.tellIfExhausted(booking);
    return false;
  }

  private async listFlags(booking: DeclineBooking, token: string): Promise<ListFlags> {
    const markedResend = Boolean(booking.refund_send_attempted_at);
    if (!markedResend || providerRefundPlan(booking.refund_provider ?? '') !== 'fedapay') {
      return { markedResend, trustEmptyList: true, settled: false, creditAged: false, limited: false };
    }
    return this.confirmedEmpty(booking, token);
  }

  /** A resend creates only after two aged empty lists, at least the confirm gap apart. */
  private async confirmedEmpty(booking: DeclineBooking, token: string): Promise<ListFlags> {
    const limits = await this.fedapayLimits();
    const raw = await this.momo.lookupFedapayExternal(booking.id);
    if (raw.limited) return this.limitedFlags();
    const aged = this.markerAged(booking, limits.lagMs);
    const look = this.holdFreshDead(raw, aged);
    if (look.kind === 'live') await this.clearListEmpty(booking, token);
    const prior = booking.refund_list_empty_at;
    const settled = look.kind === 'live' || look.provableEmpty;
    if (look.provableEmpty && aged && !prior) await this.stampListEmpty(booking, token);
    const trustEmptyList = this.emptyConfirmed(prior, look.provableEmpty, aged, limits.confirmMs);
    return { markedResend: true, trustEmptyList, settled, creditAged: aged, limited: false };
  }

  private limitedFlags(): ListFlags {
    return { markedResend: true, trustEmptyList: false, settled: false, creditAged: false, limited: true };
  }

  /** An all-dead list younger than the lag window is not a credit. */
  private holdFreshDead(look: ExternalLook, aged: boolean): ExternalLook {
    if (look.kind === 'live' && mapRefundPoll(look.status) === 'failed' && !aged) {
      return { kind: 'unknown', status: null, id: null, provableEmpty: false };
    }
    return look;
  }

  private beginListTick(booking: DeclineBooking): void {
    beginFedapayListTick(`rental-decline-${booking.id}`);
  }

  private async noteLimited(booking: DeclineBooking, token: string): Promise<RefundStatus> {
    if (!(await this.markAttempt(booking, token))) return 'refund_pending';
    await this.noteBlank(booking, token);
    return 'refund_pending';
  }

  private async noteHeld(booking: DeclineBooking, token: string): Promise<RefundStatus> {
    await this.noteBlank(booking, token);
    return 'refund_pending';
  }

  private markerAged(booking: DeclineBooking, lagMs: number): boolean {
    const at = booking.refund_send_attempted_at;
    if (!at) return false;
    const age = Date.now() - new Date(at).getTime();
    return Number.isFinite(age) && age >= lagMs;
  }

  private emptyConfirmed(prior: string | null | undefined, empty: boolean, aged: boolean, gapMs: number): boolean {
    if (!empty || !aged || !prior) return false;
    const gap = Date.now() - new Date(prior).getTime();
    return Number.isFinite(gap) && gap >= gapMs;
  }

  private async finishLookup(booking: DeclineBooking, token: string, blank: boolean, settled: boolean): Promise<void> {
    if (blank) await this.noteLookup(booking, token, settled);
    else if (settled) await this.clearStreak(booking, token);
  }

  private async noteLookup(booking: DeclineBooking, token: string, settled: boolean): Promise<void> {
    if (settled) {
      const kept = Math.max(0, (booking.refund_attempts ?? 1) - 1);
      await this.restoreAttempt(booking, token, 0, nextRefundAt(Math.max(kept, 1)));
      return;
    }
    await this.noteBlank(booking, token);
  }

  private async noteBlank(booking: DeclineBooking, token: string): Promise<void> {
    const streak = (booking.refund_unknown_streak ?? 0) + 1;
    await this.restoreAttempt(booking, token, streak, unknownRetryAt(streak));
    await this.maybeNotify(booking, token, streak, false);
  }

  private async clearStreak(booking: DeclineBooking, token: string): Promise<void> {
    const attempts = booking.refund_attempts ?? 0;
    await this.writeStreak(booking, token, attempts, 0, nextRefundAt(Math.max(attempts, 1)));
  }

  private async restoreAttempt(booking: DeclineBooking, token: string, streak: number, next: string): Promise<void> {
    const kept = Math.max(0, (booking.refund_attempts ?? 1) - 1);
    await this.writeStreak(booking, token, kept, streak, next);
  }

  private async writeStreak(booking: DeclineBooking, token: string, attempts: number, streak: number, next: string): Promise<void> {
    try {
      await this.hasura.executeMutation(Q.RESTORE_REFUND_ATTEMPT, { id: booking.id, token, attempts, next, streak });
      booking.refund_attempts = attempts;
      booking.refund_unknown_streak = streak;
    } catch (error: any) {
      this.logger.warn(`decline attempt restore: ${error?.message ?? error}`);
    }
  }

  private async pollFedapayExternal(booking: DeclineBooking, token: string): Promise<boolean> {
    this.beginListTick(booking);
    const looked = await this.momo.lookupFedapayExternal(booking.id);
    if (await this.freshDead(booking, looked)) return this.waitUnknown(booking, token);
    if (looked.kind === 'live' && looked.id) return this.closeFedapayLook(booking, token, looked);
    return this.holdFedapayLook(booking, token, looked);
  }

  private async freshDead(booking: DeclineBooking, looked: ExternalLook): Promise<boolean> {
    if (looked.kind !== 'live' || mapRefundPoll(looked.status) !== 'failed') return false;
    const limits = await this.fedapayLimits();
    return !this.markerAged(booking, limits.lagMs);
  }

  /** One empty answer, a foreign list, or a short page stays unknown. Two aged empties are absence. */
  private async holdFedapayLook(booking: DeclineBooking, token: string, looked: { provableEmpty: boolean }): Promise<boolean> {
    const limits = await this.fedapayLimits();
    const lag = limits.lagMs;
    const gap = limits.confirmMs;
    const prior = booking.refund_list_empty_at;
    const aged = this.markerAged(booking, lag);
    if (looked.provableEmpty && aged && !prior) await this.stampListEmpty(booking, token);
    if (this.emptyConfirmed(prior, looked.provableEmpty, aged, gap)) return this.noteAbsent(booking, token);
    if (looked.provableEmpty) return this.resetStreak(booking, token);
    return this.waitUnknown(booking, token);
  }

  /** A real empty list is not another unknown. The exhausted poll comes back in about an hour. */
  private async resetStreak(booking: DeclineBooking, token: string): Promise<boolean> {
    const next = new Date(Date.now() + FEDAPAY_EXHAUSTED_POLL_MS).toISOString();
    await this.restoreAttempt(booking, token, 0, next);
    return false;
  }

  private async waitUnknown(booking: DeclineBooking, token: string): Promise<boolean> {
    const streak = (booking.refund_unknown_streak ?? 0) + 1;
    await this.restoreAttempt(booking, token, streak, unknownRetryAt(streak));
    await this.maybeNotify(booking, token, streak, false);
    return false;
  }

  private async noteAbsent(booking: DeclineBooking, token: string): Promise<boolean> {
    await this.maybeNotify(booking, token, booking.refund_unknown_streak ?? 0, true);
    await this.scheduleHourly(booking, token);
    return false;
  }

  private async closeFedapayLook(
    booking: DeclineBooking,
    token: string,
    looked: { kind: string; status: string | null; id: string | null }
  ): Promise<boolean> {
    await this.clearListEmpty(booking, token);
    const status = mapRefundPoll(looked.status);
    if (status === 'refunded' && looked.id) return this.markOwned(booking, token, 'refunded', looked.id);
    if (status === 'failed' && looked.id) return (await this.failOwned(booking, this.refundPay(booking), looked.id, token)) === 'failed';
    await this.scheduleHourly(booking, token);
    return false;
  }

  private async maybeNotify(booking: DeclineBooking, token: string, streak: number, force: boolean): Promise<void> {
    const after = (await this.fedapayLimits()).noticeAfter;
    if (!force && streak < after) return;
    if (!this.noticeDue(booking.refund_unknown_notice_at)) return;
    if (booking.refund_unknown_notice_at) await this.releaseNotice(booking.id, 'unknown_streak');
    if (await this.sendStreakNotice(booking)) await this.stampNotice(booking, token);
  }

  /** The claim key is separate from manual_check. A failed send does not start the 24h silence. */
  private async sendStreakNotice(booking: DeclineBooking): Promise<boolean> {
    if (!(await this.claimNotice(booking.id, 'unknown_streak'))) return false;
    try {
      const sent = await this.notifications.notifySupportConditionRefund(this.noticeBody(booking, 'unknown_streak'));
      if (!sent) await this.releaseNotice(booking.id, 'unknown_streak');
      if (sent) this.rememberNotice(booking, 'unknown_streak');
      return sent;
    } catch (error: any) {
      this.logger.warn(`decline unknown notice: ${error?.message ?? error}`);
      await this.releaseNotice(booking.id, 'unknown_streak');
      return false;
    }
  }

  private noticeDue(at: string | null | undefined): boolean {
    if (!at) return true;
    const age = Date.now() - new Date(at).getTime();
    return Number.isFinite(age) && age >= 24 * 60 * 60_000;
  }

  private async fedapayLimits(): Promise<{ lagMs: number; confirmMs: number; noticeAfter: number }> {
    if (this.passConfig) return this.passConfig;
    const lag = await this.configNumber('rentals_fedapay_list_lag_minutes');
    const gap = await this.configNumber('rentals_fedapay_list_confirm_minutes');
    const notice = await this.configNumber('rentals_fedapay_unknown_notice_after');
    this.passConfig = {
      lagMs: this.minutesFloor(lag, RentalPickupDeclineService.fedapayListLagMs),
      confirmMs: this.minutesFloor(gap, RentalPickupDeclineService.fedapayConfirmMs),
      noticeAfter: this.noticeBound(notice),
    };
    return this.passConfig;
  }

  /** The notice count stays between 1 and 100. A missing row uses the code default. */
  private noticeBound(value: number | null): number {
    if (value == null) return RentalPickupDeclineService.unknownNoticeAfter;
    return Math.min(100, Math.max(1, value));
  }

  /** Below 10 minutes or above 24 hours is clamped. A missing row uses the code default. */
  private minutesFloor(value: number | null, fallbackMs: number): number {
    if (value == null) return fallbackMs;
    return Math.min(24 * 60, Math.max(value, 10)) * 60_000;
  }

  private async configNumber(key: string): Promise<number | null> {
    try {
      const result = await this.hasura.executeQuery<{ application_configurations?: Array<{ number_value?: number | null }> }>(Q.FEDAPAY_REFUND_CONFIG, { key });
      const value = Number(result.application_configurations?.[0]?.number_value);
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch (error: any) {
      this.logger.warn(`fedapay config ${key}: ${error?.message ?? error}`);
      return null;
    }
  }

  private async stampListEmpty(booking: DeclineBooking, token: string): Promise<void> {
    const at = new Date().toISOString();
    try {
      await this.hasura.executeMutation(Q.STAMP_LIST_EMPTY, { id: booking.id, token, at });
      booking.refund_list_empty_at = at;
    } catch (error: any) {
      this.logger.warn(`decline empty stamp: ${error?.message ?? error}`);
    }
  }

  private async clearListEmpty(booking: DeclineBooking, token: string): Promise<void> {
    try {
      await this.hasura.executeMutation(Q.CLEAR_LIST_EMPTY, { id: booking.id, token });
      booking.refund_list_empty_at = null;
    } catch (error: any) {
      this.logger.warn(`decline empty clear: ${error?.message ?? error}`);
    }
  }

  private async stampNotice(booking: DeclineBooking, token: string): Promise<void> {
    const at = new Date().toISOString();
    try {
      await this.hasura.executeMutation(Q.STAMP_UNKNOWN_NOTICE, { id: booking.id, token, at });
      booking.refund_unknown_notice_at = at;
    } catch (error: any) {
      this.logger.warn(`decline unknown notice: ${error?.message ?? error}`);
    }
  }

  private async scheduleHourly(booking: DeclineBooking, token: string): Promise<void> {
    const next = new Date(Date.now() + FEDAPAY_EXHAUSTED_POLL_MS).toISOString();
    try {
      await this.hasura.executeMutation(Q.SCHEDULE_REFUND_POLL, { id: booking.id, token, next });
      booking.refund_unknown_streak = 0;
    } catch (error: any) {
      this.logger.warn(`decline poll schedule: ${error?.message ?? error}`);
    }
  }

  private async markOwned(booking: DeclineBooking, token: string, status: RefundStatus, ref: string): Promise<boolean> {
    const provider = booking.refund_provider ?? '';
    const wrote = await this.writeOwned(booking.id, token, status, provider, ref);
    if (wrote && status === 'refunded') await this.tellRenter(booking, 'sent');
    return wrote;
  }

  /** MTN rejects a duplicate X-Reference-Id with 409. A fresh accept waits out the 404 lag. */
  private resendMtn(booking: DeclineBooking, probed: RefundStatus | 'missing' | 'unknown'): boolean {
    if (providerRefundPlan(booking.refund_provider ?? '') !== 'mtn') return false;
    if (probed !== 'missing' && probed !== 'unknown') return false;
    return this.mtnResendDue(booking.refund_sent_at);
  }

  private mtnResendDue(sentAt?: string | null): boolean {
    if (!sentAt) return true;
    const age = Date.now() - new Date(sentAt).getTime();
    return Number.isFinite(age) && age >= MTN_RESEND_MIN_MS;
  }

  private async tellIfExhausted(booking: DeclineBooking): Promise<void> {
    if ((booking.refund_attempts ?? 0) >= REFUND_ATTEMPT_LIMIT) await this.tellSupport(booking, 'exhausted');
  }

  private requirePending(booking: DeclineBooking): void {
    if (booking.refund_status !== 'refund_pending') {
      throw new HttpException('This refund is not waiting', HttpStatus.CONFLICT);
    }
  }

  private async applyMark(
    booking: DeclineBooking,
    body: { status: string; providerRef?: string; note?: string }
  ): Promise<{ status: string; providerRef?: string; note?: string }> {
    if (body.status === 'refunded') {
      await this.markPaid(booking, body);
      return body;
    }
    if (body.status === 'manual_override') return this.applyOverride(booking, body);
    const checked = await this.creditFailed(booking, body.providerRef);
    const note = [body.note, checked.reason].filter(Boolean).join(' · ');
    return { status: body.status, providerRef: checked.ref ?? undefined, note };
  }

  /** Credit only when the provider reports the payout failed. A miss stays unknown. */
  private async creditFailed(booking: DeclineBooking, typedRef?: string): Promise<{ ref: string | null; reason: string }> {
    const gate = await this.failGate(booking, typedRef);
    if (!gate.credit) throw new HttpException(this.unpaidRefusal(gate.look), HttpStatus.CONFLICT);
    const owned = await this.takeClaim(booking);
    const note = this.markedNote('failed', gate.ref ?? undefined, 'provider reported failed');
    const wrote = await this.closeMarked(owned.booking, owned.token, 'failed', gate.ref, this.refundPay(booking), note);
    if (!wrote) throw new HttpException(this.busyRefund(), HttpStatus.CONFLICT);
    await this.tellAfterCredit(owned.booking);
    return { ref: gate.ref, reason: 'provider reported failed' };
  }

  /** Credits only a row we can prove never reached a provider. The claim comes first. */
  private async applyOverride(
    booking: DeclineBooking,
    body: { providerRef?: string; note?: string }
  ): Promise<{ status: string; note?: string }> {
    this.overrideGate(booking, body);
    const prior = this.overridePrior(booking);
    const owned = await this.takeClaim(booking);
    const fresh = await this.rereadUnsent(booking.id, owned.token, prior);
    const absence = await this.overrideAbsence(fresh);
    if (absence !== 'absent') return this.stopOverride(booking.id, owned.token, prior, this.overrideRefusal(absence));
    return this.finishOverride(fresh, owned.token, body.note ?? '', prior);
  }

  private overridePrior(booking: DeclineBooking): OverridePrior {
    return {
      attempts: booking.refund_attempts ?? 0,
      nextAt: booking.refund_next_at ?? null,
      stamp: booking.refund_send_attempted_at ?? null,
    };
  }

  private overrideGate(booking: DeclineBooking, body: { providerRef?: string; note?: string }): void {
    this.rejectForeignRef(booking, body.providerRef);
    if (!(body.note ?? '').trim()) throw new HttpException('Add a note', HttpStatus.BAD_REQUEST);
    if (!this.neverReached(booking)) throw new HttpException('This refund may already have been sent', HttpStatus.CONFLICT);
  }

  private async rereadUnsent(id: string, token: string, prior: OverridePrior): Promise<DeclineBooking> {
    const fresh = await this.requireBooking(id);
    if (this.stillUnsent(fresh, prior)) return fresh;
    return this.stopOverride(id, token, prior, this.busyRefund());
  }

  /** The stamp must still be the snapshot, which is null. A cron stamp of any age fails. */
  private stillUnsent(booking: DeclineBooking, prior: OverridePrior): boolean {
    if (this.hasProviderRef(booking) || booking.refund_sent_at) return false;
    if ((booking.refund_attempts ?? 0) !== prior.attempts + 1) return false;
    return (booking.refund_send_attempted_at ?? null) === prior.stamp;
  }

  private async stopOverride(id: string, token: string, prior: OverridePrior, message: string): Promise<never> {
    await this.releaseClaim(id, token, prior);
    throw new HttpException(message, HttpStatus.CONFLICT);
  }

  private async finishOverride(
    booking: DeclineBooking,
    token: string,
    noteText: string,
    prior: OverridePrior
  ): Promise<{ status: string; note?: string }> {
    const note = [noteText, 'manual_override'].filter(Boolean).join(' · ');
    const wrote = await this.closeOverride(booking, token, note, prior.stamp);
    if (!wrote) return this.stopOverride(booking.id, token, prior, this.busyRefund());
    await this.tellAfterCredit(booking);
    return { status: 'manual_override', note };
  }

  private async closeOverride(booking: DeclineBooking, token: string, note: string, stamp: string | null): Promise<boolean> {
    const notes = this.markedNote('manual_override', undefined, note);
    return this.closeMarked(booking, token, 'failed', null, this.refundPay(booking), notes, { sendAt: stamp });
  }

  private async releaseClaim(id: string, token: string, prior: OverridePrior): Promise<void> {
    try {
      await this.hasura.executeMutation(Q.RELEASE_CLAIM, {
        id, token, attempts: prior.attempts, nextAt: prior.nextAt,
      });
    } catch (error: any) {
      this.logger.warn(`decline claim release: ${error?.message ?? error}`);
    }
  }

  private neverReached(booking: DeclineBooking): boolean {
    return !this.hasProviderRef(booking) && !booking.refund_sent_at && !booking.refund_send_attempted_at;
  }

  private async overrideAbsence(booking: DeclineBooking): Promise<OverrideLook> {
    const plan = providerRefundPlan(booking.refund_provider ?? '');
    if (plan === 'fedapay') return this.fedapayAbsence(booking);
    if (plan !== 'freemopay' && plan !== 'mtn') return 'unknown';
    return this.stableAbsence(booking, plan);
  }

  private async stableAbsence(booking: DeclineBooking, plan: string): Promise<OverrideLook> {
    const looked = await this.momo.probe(booking.refund_provider ?? '', stableRefundReference(booking.id));
    if (looked === 'unknown') return 'unknown';
    if (looked !== 'missing') return 'live';
    if (plan === 'mtn' && !this.mtnMissAged(booking)) return 'early';
    return 'absent';
  }

  private async fedapayAbsence(booking: DeclineBooking): Promise<OverrideLook> {
    const externalId = this.momo.externalRefundId(booking.id);
    const spendKey = `override-${externalId}`;
    beginFedapayListTick(spendKey);
    const looked = await this.momo.probeByExternalId(booking.refund_provider ?? '', externalId, spendKey);
    if (looked === 'unknown') return 'unknown';
    return looked === 'missing' ? 'absent' : 'live';
  }

  private mtnMissAged(booking: DeclineBooking): boolean {
    const at = booking.refund_requested_at ?? booking.refund_claim_at;
    if (!at) return false;
    const age = Date.now() - new Date(at).getTime();
    return Number.isFinite(age) && age >= MTN_OVERRIDE_LAG_MS;
  }

  private overrideRefusal(look: OverrideLook): string {
    if (look === 'live') return 'A payout exists';
    return 'The provider did not confirm this payout is unpaid';
  }

  private unpaidRefusal(look: 'refunded' | 'unknown'): string {
    if (look === 'refunded') return 'A payout exists';
    return 'The provider did not confirm this payout is unpaid';
  }

  private busyRefund(): string {
    return 'This refund is being processed. Retry shortly.';
  }

  private async failGate(booking: DeclineBooking, typedRef?: string): Promise<FailGate> {
    this.rejectForeignRef(booking, typedRef);
    const refs = this.failRefs(booking);
    if (refs.length === 0) return { credit: false, look: 'unknown' };
    const probed = await this.probeFailRefs(booking, refs);
    return this.failVerdict(probed, refs);
  }

  private rejectForeignRef(booking: DeclineBooking, typedRef?: string): void {
    const typed = (typedRef ?? '').trim();
    if (!typed || this.ownsRef(booking, typed)) return;
    throw new HttpException("That reference is not this booking's payout", HttpStatus.BAD_REQUEST);
  }

  private ownsRef(booking: DeclineBooking, ref: string): boolean {
    const stored = (booking.refund_provider_ref ?? '').trim();
    return ref === stored || ref === stableRefundReference(booking.id);
  }

  private failRefs(booking: DeclineBooking): string[] {
    const stored = (booking.refund_provider_ref ?? '').trim();
    const stable = this.stableProbe(booking);
    const refs = stable ? [stable] : [];
    if (stored && !refs.includes(stored)) refs.push(stored);
    return refs;
  }

  /** FreemoPay and MTN can be asked about this booking's stable id. */
  private stableProbe(booking: DeclineBooking): string {
    const plan = providerRefundPlan(booking.refund_provider ?? '');
    if (plan !== 'freemopay' && plan !== 'mtn') return '';
    return stableRefundReference(booking.id);
  }

  private async probeFailRefs(booking: DeclineBooking, refs: string[]): Promise<FailProbe[]> {
    const provider = booking.refund_provider ?? '';
    const probed: FailProbe[] = [];
    for (const ref of refs) probed.push(await this.momo.probe(provider, ref));
    return probed;
  }

  private failVerdict(probed: FailProbe[], refs: string[]): FailGate {
    if (probed.includes('refunded')) return { credit: false, look: 'refunded' };
    if (probed.some((item) => item === 'refund_pending' || item === 'unknown')) {
      return { credit: false, look: 'unknown' };
    }
    const failedAt = this.failedRef(probed);
    if (failedAt >= 0) return { credit: true, ref: refs[failedAt] ?? null };
    return { credit: false, look: 'unknown' };
  }

  /** Prefer the provider's own reference when the stable id is also failed. */
  private failedRef(probed: FailProbe[]): number {
    const own = probed.findIndex((item, index) => item === 'failed' && index > 0);
    if (own >= 0) return own;
    return probed.findIndex((item) => item === 'failed');
  }

  private async markPaid(booking: DeclineBooking, body: { providerRef?: string; note?: string }): Promise<void> {
    this.rejectForeignRef(booking, body.providerRef);
    const ref = this.keptRef(booking, body.providerRef);
    const looked = await this.look(booking, ref);
    if (looked !== 'refunded') throw new HttpException('The provider did not confirm this payout', HttpStatus.CONFLICT);
    await this.writeRefunded(booking, ref, this.markedNote('refunded', ref ?? undefined, body.note));
  }

  /** A stored reference stays. A typed reference is kept only when nothing is stored yet. */
  private keptRef(booking: DeclineBooking, typed?: string): string | null {
    const stored = (booking.refund_provider_ref ?? '').trim();
    if (stored) return stored;
    const typedRef = (typed ?? '').trim();
    return typedRef || null;
  }

  private async look(booking: DeclineBooking, ref: string | null): Promise<FailProbe> {
    if (!ref) return 'unknown';
    return this.momo.probe(booking.refund_provider ?? '', ref);
  }

  private async writeRefunded(booking: DeclineBooking, ref: string | null, notes: string): Promise<void> {
    const owned = await this.takeClaim(booking);
    const wrote = await this.closeMarked(owned.booking, owned.token, 'refunded', ref, 0, notes);
    if (!wrote) throw new HttpException(this.busyRefund(), HttpStatus.CONFLICT);
    await this.tellRenter(owned.booking, 'sent');
  }

  private markedNote(status: string, providerRef?: string, note?: string): string {
    const text = [status, providerRef, note].filter(Boolean).join(' · ');
    return `Refund marked ${text}`;
  }

  private async tellAfterCredit(booking: DeclineBooking): Promise<void> {
    await this.tellRenter(booking, 'wallet');
    await this.tellSupport(booking, 'failed');
  }

  /** Credit, claim close, and the audit row are one database transaction. */
  private async closeMarked(
    booking: DeclineBooking,
    token: string,
    status: RefundStatus,
    providerRef: string | null,
    amount: number,
    notes: string,
    guard?: { sendAt: string | null }
  ): Promise<boolean> {
    if (!(await this.keepClaim(booking.id, token))) return false;
    const args = await this.closeArgs(booking, token, status, providerRef, amount, notes, guard);
    try {
      return await this.closedRow(Q.CLOSE_DECLINE_REFUND, args);
    } catch (error: any) {
      if (!this.guardFieldMissing(error)) throw error;
      if (args.guardOpen) return false;
      return this.closedRow(Q.CLOSE_DECLINE_REFUND_PLAIN, args);
    }
  }

  private async closedRow(query: string, args: Record<string, unknown>): Promise<boolean> {
    const closed = await this.hasura.executeMutation<{ close_decline_refund?: Array<{ id: string }> }>(query, args);
    return (closed.close_decline_refund?.length ?? 0) === 1;
  }

  /** Migration 20261120170000 is not applied yet. An unguarded close still uses the 12-argument call. */
  private guardFieldMissing(error: any): boolean {
    const text = `${error?.message ?? ''} ${error?.response?.errors?.[0]?.message ?? ''}`.toLowerCase();
    return text.includes('p_guard_open') && text.includes('not found');
  }

  private async closeArgs(
    booking: DeclineBooking,
    token: string,
    status: RefundStatus,
    providerRef: string | null,
    amount: number,
    notes: string,
    guard?: { sendAt: string | null }
  ) {
    const user = await this.users.getUser();
    const pay = amount > 0 ? amount : 0;
    const accountId = pay > 0 ? await this.refundAccount(booking) : null;
    const key = rentalLedgerKey(booking.id, 'decline:refund:reversal');
    const memo = `Condition decline refund returned ${booking.id}`;
    return {
      id: booking.id, token, status, providerRef, accountId, notes, memo,
      provider: booking.refund_provider ?? '', amount: pay, idempotencyKey: key,
      changedBy: user.id, previousStatus: booking.status,
      sendAttemptedAt: guard?.sendAt ?? null, guardOpen: Boolean(guard),
    };
  }

  private async refundAccount(booking: DeclineBooking): Promise<string> {
    const result = await this.hasura.executeQuery<{ accounts?: Array<{ id: string }> }>(Q.REFUND_ACCOUNT, {
      userId: booking.client.user_id,
      currency: booking.currency,
    });
    const id = result.accounts?.[0]?.id;
    if (!id) throw new HttpException('Account missing', HttpStatus.BAD_GATEWAY);
    return id;
  }

  private async takeClaim(booking: DeclineBooking): Promise<{ booking: DeclineBooking; token: string }> {
    const token = randomUUID();
    const attempts = booking.refund_attempts ?? 0;
    if (!(await this.claimWork(booking, attempts, token))) {
      throw new HttpException(this.busyRefund(), HttpStatus.CONFLICT);
    }
    return { token, booking: { ...booking, refund_claim_token: token } };
  }

  private async failRefund(
    booking: DeclineBooking,
    amount: number,
    providerRef?: string | null,
    token?: string
  ): Promise<boolean> {
    if (token && !(await this.keepClaim(booking.id, token))) return false;
    const full = booking.client?.user_id ? booking : await this.requireBooking(booking.id);
    const pay = amount > 0 ? amount : moneyAmount(full.refund_amount);
    if (pay > 0) await this.rentals.restoreDeclinePayout(full, pay);
    if (pay > 0) await this.markCredited(full.id);
    if (pay > 0) await this.tellRenter(full, 'wallet');
    const wrote = token
      ? await this.writeOwned(full.id, token, 'failed', full.refund_provider ?? '', providerRef ?? null)
      : await this.writePolled(full.id, 'failed', providerRef ?? undefined);
    if (wrote) await this.tellSupport(full, 'failed');
    return wrote;
  }

  private async failOwned(booking: DeclineBooking, amount: number, providerRef: string | null, token: string): Promise<RefundStatus> {
    const done = await this.failRefund(booking, amount, providerRef, token);
    return done ? 'failed' : 'refund_pending';
  }

  private refundPay(booking: DeclineBooking): number {
    return moneyAmount(booking.refund_amount);
  }

  private async writePolled(bookingId: string, status: 'refunded' | 'failed', providerRef?: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.hasura.executeMutation<{ update_rental_bookings?: { affected_rows: number } }>(
      Q.APPLY_REFUND_POLL,
      {
        id: bookingId,
        set: {
          refund_status: status,
          refund_status_at: now,
          refunded_at: status === 'refunded' ? now : null,
          refund_claim_at: null,
          refund_claim_token: null,
          ...(providerRef ? { refund_provider_ref: providerRef } : {}),
        },
      }
    );
    return (result.update_rental_bookings?.affected_rows ?? 0) === 1;
  }

  private async keepClaim(bookingId: string, token: string): Promise<boolean> {
    const result = await this.hasura.executeMutation<{ update_rental_bookings?: { affected_rows: number } }>(
      Q.KEEP_REFUND_CLAIM,
      { id: bookingId, token, at: new Date().toISOString() }
    );
    return (result.update_rental_bookings?.affected_rows ?? 0) === 1;
  }

  private async reconcileRow(booking: DeclineBooking): Promise<number> {
    try {
      return (await this.reconcileOne(booking)) ? 1 : 0;
    } catch (error: any) {
      this.logger.error(`decline refund ${booking.booking_number}: ${error?.message ?? error}`);
      await this.alertRefund(booking);
      return 0;
    }
  }

  private async alertRefund(booking: DeclineBooking): Promise<void> {
    try {
      await this.tellSupport(booking, 'retry');
    } catch (error: any) {
      this.logger.error(`decline refund alert: ${error?.message ?? error}`);
    }
  }

  private async requireMarkPermission(status: string): Promise<void> {
    const user = await this.users.getUser();
    const access = await this.rbac.getEffectiveAccess(user.id);
    const allowed = status === 'manual_override' ? refundOverrideAllowed(access) : refundMarkAllowed(access);
    if (!allowed) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
  }

  private async viewerPhotos(booking: { business_id?: string }, declineId: string) {
    const user = await this.users.getUser();
    if (!isActivePersona(user, 'business') || user.business?.id !== booking.business_id) return [];
    return this.photos.signedForDecline(declineId);
  }

  private publicDecline(booking: any, row: DeclineRow, photos: unknown[]) {
    return {
      reason: row.reason,
      reasonText: row.reason_text,
      rail: row.money_rail,
      amount: moneyAmount(row.money_amount),
      currency: row.money_currency,
      phoneMask: row.phone_mask,
      refundStatus: booking.refund_status ?? 'none',
      walletCredited: Boolean(booking.refund_credited_at),
      refundSent: Boolean(booking.refund_sent_at),
      photos,
    };
  }

  private toResult(
    booking: DeclineBooking,
    row: DeclineRow,
    ledger: Ledger,
    refundStatus: RefundStatus,
    idempotent: boolean
  ): DeclineResult {
    return {
      success: true,
      idempotent,
      bookingId: booking.id,
      status: 'cancelled',
      rail: row.money_rail ?? ledger.rail,
      refundStatus,
      amount: moneyAmount(row.money_amount ?? ledger.amount),
      currency: row.money_currency ?? ledger.currency,
      phoneMask: row.phone_mask ?? ledger.phoneMask,
      reason: row.reason,
      reasonText: row.reason_text,
    };
  }

  private async requireBooking(id: string): Promise<DeclineBooking> {
    const result = await this.hasura.executeQuery<{ rental_bookings_by_pk: DeclineBooking | null }>(
      Q.DECLINE_BOOKING,
      { id }
    );
    if (!result.rental_bookings_by_pk) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    return result.rental_bookings_by_pk;
  }

  private async requireFlag(booking: DeclineBooking): Promise<void> {
    if (!(await this.flags.pickupDeclineEnabled(this.country(booking)))) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
  }

  private requireRenter(user: { client?: { id?: string } }, booking: DeclineBooking): void {
    if (!isActivePersona(user, 'client') || user.client?.id !== booking.client_id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  private requireOpen(booking: DeclineBooking, versionId: string): void {
    const guard = declineGuard(booking, versionId);
    if (guard === 'ok') return;
    if (guard === 'accepted') throw new HttpException('Report a problem', HttpStatus.CONFLICT);
    if (guard === 'version') throw new HttpException('This condition report changed', HttpStatus.CONFLICT);
    if (guard === 'not_inspected') throw new HttpException('This rental has no condition report', HttpStatus.BAD_REQUEST);
    throw new HttpException('This rental can no longer be declined', HttpStatus.CONFLICT);
  }

  private reason(input: DeclineInput): { reason: DeclineReason; text: string | null } {
    if (!isDeclineReason(input.reason)) throw new HttpException('Choose a reason', HttpStatus.BAD_REQUEST);
    const text = otherReasonText(input.reason, input.text);
    if (input.reason === 'other' && !text) throw new HttpException('Describe the problem', HttpStatus.BAD_REQUEST);
    return { reason: input.reason, text };
  }

  private async find(bookingId: string, versionId: string): Promise<DeclineRow | null> {
    const result = await this.hasura.executeQuery<{ rental_condition_declines: DeclineRow[] }>(Q.FIND_DECLINE, {
      bookingId,
      versionId,
    });
    return result.rental_condition_declines?.[0] ?? null;
  }

  private async findForBooking(bookingId: string): Promise<DeclineRow | null> {
    const result = await this.hasura.executeQuery<{ rental_condition_declines: DeclineRow[] }>(
      Q.FIND_DECLINE_FOR_BOOKING,
      { bookingId }
    );
    return result.rental_condition_declines?.[0] ?? null;
  }

  private kept(booking: DeclineBooking): RefundStatus {
    return booking.refund_status && booking.refund_status !== 'none' ? booking.refund_status : 'none';
  }

  private country(booking: { rental_location_listing?: DeclineBooking['rental_location_listing'] }): string | null {
    return booking.rental_location_listing?.business_location?.address?.country ?? null;
  }
}

type OverrideLook = 'absent' | 'live' | 'unknown' | 'early';
type FailProbe = RefundStatus | 'missing' | 'unknown';
type FailGate = { credit: true; ref: string | null } | { credit: false; look: 'refunded' | 'unknown' };
