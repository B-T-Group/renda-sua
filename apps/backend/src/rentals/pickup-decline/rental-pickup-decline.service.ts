import { HttpException, HttpStatus, Inject, Injectable, OnModuleInit, forwardRef } from '@nestjs/common';
import { DeliveryPinService } from '../../delivery-pin/delivery-pin.service';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { RbacService } from '../../rbac/rbac.service';
import { isActivePersona } from '../../users/persona.util';
import { casUpdateRentalBooking } from '../rental-booking-cas';
import { INSERT_RENTAL_STATUS_HISTORY } from '../rentals-queries';
import { RentalInspectionFlags } from '../inspection/rental-inspection-flags.service';
import { RentalsService } from '../rentals.service';
import { registerLateCollectRefund } from './late-collect-refund';
import { isDeclineEvidenceKey } from './pickup-decline.keys';
import {
  capRefund,
  declineRail,
  fedapayChannel,
  maskMomoPhone,
  moneyAmount,
  nextRefundAt,
  providerRefundPlan,
  REFUND_ATTEMPT_LIMIT,
  refundSource,
  sumCollected,
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
  type DeclineReason,
} from './pickup-decline.policy';
import * as Q from './pickup-decline.queries';
import { RentalConditionPhotosService } from './rental-condition-photos.service';
import { RentalMomoRefundService } from './rental-momo-refund.service';

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

interface DeclineRow {
  id: string;
  reason: string;
  reason_text: string | null;
  money_rail: DeclineRail;
  money_amount: number | string;
  money_currency: string | null;
  phone_mask: string | null;
  version_id?: string;
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

@Injectable()
export class RentalPickupDeclineService implements OnModuleInit {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly users: HasuraUserService,
    private readonly flags: RentalInspectionFlags,
    private readonly momo: RentalMomoRefundService,
    private readonly photos: RentalConditionPhotosService,
    private readonly notifications: NotificationsService,
    private readonly pins: DeliveryPinService,
    @Inject(forwardRef(() => RentalsService)) private readonly rentals: RentalsService,
    private readonly rbac: RbacService
  ) {}

  onModuleInit(): void {
    registerLateCollectRefund((bookingId) => this.refundLateCollect(bookingId));
  }

  async decline(bookingId: string, input: DeclineInput): Promise<DeclineResult> {
    const user = await this.users.getUser();
    const booking = await this.requireBooking(bookingId);
    await this.requireFlag(booking);
    this.requireRenter(user, booking);
    const reason = this.reason(input);
    const stored = await this.findForBooking(booking.id);
    if (stored) return this.resume(booking, stored);
    this.requireOpen(booking, input.versionId);
    await this.requirePhotos(booking.id, input.photos ?? []);
    return this.cancelAndRecord(booking, user.id, input, reason);
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
    const now = new Date().toISOString();
    const result = await this.hasura.executeQuery<{ rental_bookings: DeclineBooking[] }>(Q.PENDING_REFUNDS, {
      now,
    });
    let updated = 0;
    for (const booking of result.rental_bookings ?? []) {
      if (await this.reconcileOne(booking)) updated += 1;
    }
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
    body: { status: 'refunded' | 'failed'; providerRef?: string; note?: string }
  ): Promise<{ refundStatus: RefundStatus }> {
    await this.requireRefundPermission();
    const booking = await this.requireBooking(bookingId);
    await this.requireFlag(booking);
    if (booking.refund_status !== 'refund_pending') {
      throw new HttpException('This refund is not waiting', HttpStatus.CONFLICT);
    }
    if (!refundMarkEvidence(body.providerRef, body.note)) {
      throw new HttpException('Add the provider reference or a note', HttpStatus.BAD_REQUEST);
    }
    await this.writePolled(bookingId, body.status, body.providerRef);
    await this.auditRefund(booking, body);
    return { refundStatus: body.status };
  }

  /** A collect that succeeds after the decline uses the same payout path. */
  async refundLateCollect(bookingId: string): Promise<void> {
    const booking = await this.requireBooking(bookingId);
    if (!booking.condition_declined_at) return;
    if (booking.refund_status && booking.refund_status !== 'none') return;
    const ledger = await this.ledger(booking);
    if (ledger.rail !== 'momo_paid') return;
    await this.rentals.consumeDeclineHold(booking, ledger.amount);
    const status = await this.refundCollected(booking, ledger);
    if (this.payoutFailed(status, ledger)) await this.rentals.restoreDeclinePayout(booking, ledger.amount);
  }

  private async cancelAndRecord(
    booking: DeclineBooking,
    userId: string,
    input: DeclineInput,
    reason: { reason: DeclineReason; text: string | null }
  ): Promise<DeclineResult> {
    const ledger = await this.ledger(booking);
    const won = await this.claimCancel(booking, input.versionId);
    if (!won) return this.lost(booking, input.versionId);
    try {
      await this.moveFunds(booking, ledger);
      await this.cancelPendingCollects(booking.booking_number);
    } catch (error: any) {
      await this.revertCancel(booking);
      throw error;
    }
    return this.record(booking, userId, input, reason, ledger);
  }

  private async moveFunds(booking: DeclineBooking, ledger: Ledger): Promise<void> {
    if (ledger.rail === 'momo_paid') {
      await this.rentals.consumeDeclineHold(booking, ledger.amount);
      return;
    }
    await this.rentals.releaseFreeCancelFunds(booking);
  }

  private async record(
    booking: DeclineBooking,
    userId: string,
    input: DeclineInput,
    reason: { reason: DeclineReason; text: string | null },
    ledger: Ledger
  ): Promise<DeclineResult> {
    const saved = await this.insertDecline(booking, userId, input.versionId, reason, ledger);
    if (!saved.created) return this.resume(booking, saved.row);
    const refundStatus = await this.maybeRefund(booking, ledger);
    if (ledger.rail === 'momo_paid' && this.payoutFailed(refundStatus, ledger)) {
      await this.rentals.restoreDeclinePayout(booking, ledger.amount);
    }
    await this.after(booking, userId, saved.row.id, input.photos ?? []);
    return this.toResult(booking, saved.row, ledger, refundStatus, false);
  }

  /** Unsupported and a provider failure are final. A timeout stays pending and is polled. */
  private payoutFailed(status: RefundStatus, ledger: Ledger): boolean {
    if (status === 'failed') return true;
    return status === 'refund_pending' && providerRefundPlan(ledger.provider ?? '') === 'unsupported';
  }

  private async resume(booking: DeclineBooking, row: DeclineRow): Promise<DeclineResult> {
    if (row.money_rail === 'momo_paid' && this.kept(booking) === 'none') {
      const ledger = await this.ledger(booking);
      return this.toResult(booking, row, ledger, await this.refundCollected(booking, ledger), true);
    }
    return this.toResult(booking, row, this.storedLedger(booking, row), this.kept(booking), true);
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

  private async maybeRefund(booking: DeclineBooking, ledger: Ledger): Promise<RefundStatus> {
    if (ledger.rail !== 'momo_paid') return 'none';
    if (booking.refund_status && booking.refund_status !== 'none') return booking.refund_status;
    return this.refundCollected(booking, ledger);
  }

  private async refundCollected(booking: DeclineBooking, ledger: Ledger): Promise<RefundStatus> {
    const source = refundSource(ledger.collects, booking.currency);
    if (!source || !(await this.claimRefund(booking.id, ledger, source.provider))) {
      return source ? this.currentRefund(booking.id) : this.unsupported(booking, ledger);
    }
    return this.callProvider(booking, ledger, source);
  }

  private async callProvider(
    booking: DeclineBooking,
    ledger: Ledger,
    source: CollectedPayment
  ): Promise<RefundStatus> {
    try {
      const result = await this.momo.refund({
        bookingId: booking.id,
        amount: ledger.amount,
        currency: booking.currency,
        provider: source.provider,
        phone: source.phone,
        transactionId: source.transactionId,
        channel: fedapayChannel(source.phone, source.channel),
      });
      await this.writeRefund(booking.id, result.status, result.provider, result.providerRef);
      if (result.unsupported || result.status === 'failed') {
        await this.tellSupport(booking, result.unsupported ? 'unsupported' : 'failed');
      }
      return result.status;
    } catch (error: any) {
      void error;
      return 'refund_pending';
    }
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

  private async revertCancel(booking: DeclineBooking): Promise<void> {
    await casUpdateRentalBooking(this.hasura, booking.id, ['cancelled'], {
      status: booking.status,
      payment_status: booking.payment_status,
      contract_expires_at: booking.contract_expires_at,
      condition_declined_at: null,
    });
  }

  private async lost(booking: DeclineBooking, versionId: string): Promise<DeclineResult> {
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
      if (id) return { row: { id, ...object } as DeclineRow, created: true };
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

  private async claimRefund(bookingId: string, ledger: Ledger, provider: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.hasura.executeMutation<{ update_rental_bookings?: { affected_rows: number } }>(
      Q.STAMP_REFUND,
      {
        id: bookingId,
        set: {
          refund_status: 'refund_pending',
          refund_requested_at: now,
          refund_status_at: now,
          refund_amount: ledger.amount,
          refund_currency: ledger.currency,
          refund_provider: provider,
        },
      }
    );
    return (result.update_rental_bookings?.affected_rows ?? 0) === 1;
  }

  private async writeRefund(
    bookingId: string,
    status: RefundStatus,
    provider: string,
    providerRef: string | null
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.APPLY_REFUND_POLL, {
      id: bookingId,
      set: {
        refund_status: status,
        refund_status_at: now,
        refund_provider: provider,
        refund_provider_ref: providerRef,
        refunded_at: status === 'refunded' ? now : null,
      },
    });
  }

  private async unsupported(booking: DeclineBooking, ledger: Ledger): Promise<RefundStatus> {
    await this.claimRefund(booking.id, ledger, 'unsupported');
    await this.tellSupport(booking, 'unsupported');
    return 'refund_pending';
  }

  private async currentRefund(bookingId: string): Promise<RefundStatus> {
    const fresh = await this.requireBooking(bookingId);
    return fresh.refund_status ?? 'refund_pending';
  }

  private async after(booking: DeclineBooking, userId: string, declineId: string, photos: string[]): Promise<void> {
    if (photos.length > 0) {
      await this.hasura.executeMutation(Q.LINK_PHOTOS, { ids: photos, bookingId: booking.id, declineId });
    }
    await this.hasura.executeMutation(INSERT_RENTAL_STATUS_HISTORY, {
      object: {
        rental_booking_id: booking.id,
        status: 'cancelled',
        previous_status: booking.status,
        changed_by_user_id: userId,
        changed_by_type: 'client',
        notes: 'Renter declined the pickup condition',
      },
    });
    await this.pins.clearPinForOrder(booking.id);
    await this.notifyBusiness(booking);
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
    await this.notifications.notifySupportConditionRefund({
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
      rentalItemName: booking.rental_location_listing?.rental_item?.name || 'the item',
      outcome,
    });
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
    const attempts = (booking.refund_attempts ?? 0) + 1;
    if (!booking.refund_provider_ref) return this.retryPayout(booking, attempts);
    if (!booking.refund_provider) return false;
    const status = await this.momo.poll(booking.refund_provider, booking.refund_provider_ref);
    if (status !== 'refunded' && status !== 'failed') return this.keepPending(booking, attempts);
    await this.writePolled(booking.id, status);
    if (status === 'failed') await this.restoreAndTell(booking);
    return true;
  }

  private async retryPayout(booking: DeclineBooking, attempts: number): Promise<boolean> {
    const ledger = await this.ledger(booking);
    const source = refundSource(ledger.collects, booking.currency);
    const status = source ? await this.callProvider(booking, ledger, source) : 'refund_pending';
    if (this.payoutFailed(status, ledger)) {
      await this.rentals.restoreDeclinePayout(booking, ledger.amount);
      return true;
    }
    if (status === 'refund_pending') await this.keepPending(booking, attempts);
    return status === 'refunded';
  }

  private async keepPending(booking: DeclineBooking, attempts: number): Promise<boolean> {
    await this.noteAttempt(booking.id, attempts);
    if (attempts >= REFUND_ATTEMPT_LIMIT) await this.tellSupport(booking, 'exhausted');
    return false;
  }

  private async restoreAndTell(booking: DeclineBooking): Promise<void> {
    const amount = moneyAmount(booking.refund_amount);
    if (amount > 0) await this.rentals.restoreDeclinePayout(booking, amount);
    await this.tellSupport(booking, 'failed');
  }

  private async noteAttempt(bookingId: string, attempts: number): Promise<void> {
    await this.hasura.executeMutation(Q.APPLY_REFUND_POLL, {
      id: bookingId,
      set: { refund_attempts: attempts, refund_next_at: nextRefundAt(attempts) },
    });
  }

  private async writePolled(
    bookingId: string,
    status: 'refunded' | 'failed',
    providerRef?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.APPLY_REFUND_POLL, {
      id: bookingId,
      set: {
        refund_status: status,
        refund_status_at: now,
        refunded_at: status === 'refunded' ? now : null,
        ...(providerRef ? { refund_provider_ref: providerRef } : {}),
      },
    });
  }

  private async auditRefund(
    booking: DeclineBooking,
    body: { status: string; providerRef?: string; note?: string }
  ): Promise<void> {
    const user = await this.users.getUser();
    const note = [body.status, body.providerRef, body.note].filter(Boolean).join(' · ');
    await this.hasura.executeMutation(INSERT_RENTAL_STATUS_HISTORY, {
      object: {
        rental_booking_id: booking.id,
        status: 'cancelled',
        previous_status: booking.status,
        changed_by_user_id: user.id,
        changed_by_type: 'system',
        notes: `Refund marked ${note}`,
      },
    });
  }

  private async requireRefundPermission(): Promise<void> {
    const user = await this.users.getUser();
    const access = await this.rbac.getEffectiveAccess(user.id);
    if (!refundMarkAllowed(access)) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
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
