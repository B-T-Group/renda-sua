import { Injectable, Logger } from '@nestjs/common';
import { resolveItemCountry } from '../mobile-payments/item-country.util';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RentalInspectionService } from './inspection/rental-inspection.service';
import { RentalPickupDeclineService } from './pickup-decline/rental-pickup-decline.service';
import { RentalRenterReturnService } from './renter-return/rental-renter-return.service';
import { casUpdateRentalBooking } from './rental-booking-cas';
import { listingDashboardFlag, type DashboardRequestFlagRow } from './rental-dashboard-flag';
import {
  autodeclineBounds,
  cutoffForCountry,
  expiryClauses,
  noResponseRecipients,
  pendingExpiryWhere,
  expireUnansweredRentalRequests,
  type AutodeclineConfigRow,
  type NoResponseRecipient,
  type SideEffectJob,
  type UnansweredRentalRequest,
} from './rental-request-expiry';
import { earliestRequestStartIso, effectiveRespondBy, type RentalRespondWindow } from './rental-respond-by';
import { RentalsService } from './rentals.service';
import * as Q from './rentals-queries';
import { isStartDay, listingZoneFor, startOpensAt, wallClockReached } from './simple-start/simple-start.policy';
import { WALL_CLOCK_MAX_SKEW_MS } from './wall-clock';
import { bookingReturnDueAt } from './return-due';

function listedRecipients(value: unknown): NoResponseRecipient[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const recipients = value.filter((item): item is NoResponseRecipient => item === 'renter' || item === 'business');
  return recipients.length ? recipients : undefined;
}

/**
 * Singleton cron host for rental system jobs.
 * HasuraUserService is CLS-backed, not request-scoped, so the rental services are singletons.
 */
@Injectable()
export class RentalsCronService {
  private readonly logger = new Logger(RentalsCronService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService,
    private readonly inspections: RentalInspectionService,
    private readonly rentalsService: RentalsService,
    private readonly renterReturns: RentalRenterReturnService,
    private readonly declines: RentalPickupDeclineService
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcileConditionRefunds(): Promise<void> {
    try {
      const updated = await this.declines.reconcilePending();
      if (updated > 0) this.logger.log(`Updated ${updated} condition-decline refund(s)`);
    } catch (error: any) {
      this.logger.error(`condition refund poll: ${error?.message ?? error}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleRentalPeriodEnd(): Promise<void> {
    try {
      const n = await this.processEndedActiveBookings();
      if (n > 0) {
        this.logger.log(`Processed ${n} rental period end(s)`);
      }
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleRentalEndingSoonReminders(): Promise<void> {
    try {
      const n = await this.sendEndingSoonReminders();
      if (n > 0) {
        this.logger.log(`Sent ${n} rental ending-soon reminder(s)`);
      }
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredProposedRentalContracts(): Promise<void> {
    try {
      const n = await this.expireProposedRentalContracts();
      if (n > 0) {
        this.logger.log(`Expired ${n} proposed rental contract(s)`);
      }
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  /** Pending requests past respond_by. Off while rentals_dashboard_requests_enabled is false. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleUnansweredRentalRequests(): Promise<void> {
    try {
      const n = await this.expireUnansweredRentalRequests();
      if (n > 0) this.logger.log(`Auto-declined ${n} unanswered rental request(s)`);
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleRentalNoShows(): Promise<void> {
    try {
      const n = await this.cancelNoShowBookings();
      if (n > 0) this.logger.log(`Cancelled ${n} rental no-show(s)`);
    } catch (error: any) {
      this.logger.error(`rental no-show: ${error?.message ?? error}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleRentalStartDayReminders(): Promise<void> {
    try {
      const n = await this.remindStartDayBookings();
      if (n > 0) this.logger.log(`Sent ${n} rental pickup-day reminder(s)`);
    } catch (error: any) {
      this.logger.error(`rental start day: ${error?.message ?? error}`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredReservedRentalBookings(): Promise<void> {
    try {
      const n = await this.expireReservedRentalBookings();
      if (n > 0) {
        this.logger.log(`Released ${n} expired unpaid reservation(s)`);
      }
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  /**
   * Return due (return_due_at, else end_at) is listing wall clock: widen the query,
   * then check each booking on its own clock.
   */
  async processEndedActiveBookings(): Promise<number> {
    const clock = new Date();
    const now = clock.toISOString();
    const res = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{ id: string }>;
    }>(Q.LIST_ACTIVE_BOOKINGS_PAST_END, { now: wallClockHorizon(clock) });
    let moved = 0;
    for (const b of res.rental_bookings || []) {
      try {
        if (await this.transitionActiveToAwaitingReturn(b.id, now)) moved += 1;
      } catch (error: any) {
        this.logger.error(`processEndedActiveBookings ${b.id}: ${error.message}`);
      }
    }
    return moved;
  }

  /** T−30m reminders to client + business; end_reminder_sent_at is the idempotency guard. */
  async sendEndingSoonReminders(): Promise<number> {
    const now = new Date();
    const res = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{ id: string }>;
    }>(Q.LIST_ACTIVE_BOOKINGS_ENDING_SOON, {
      now: new Date(now.getTime() - WALL_CLOCK_MAX_SKEW_MS).toISOString(),
      until: new Date(now.getTime() + WALL_CLOCK_MAX_SKEW_MS + ENDING_SOON_MS).toISOString(),
    });
    let sent = 0;
    for (const b of res.rental_bookings || []) {
      try {
        if (await this.remindOneEndingSoonBooking(b.id, now)) sent += 1;
      } catch (error: any) {
        this.logger.error(`sendEndingSoonReminders ${b.id}: ${error.message}`);
      }
    }
    return sent;
  }

  private async remindOneEndingSoonBooking(bookingId: string, now: Date): Promise<boolean> {
    const booking = await this.fetchBooking(bookingId);
    if (
      !booking ||
      booking.status !== 'active' ||
      booking.end_reminder_sent_at ||
      !endsWithinOnListingClock(booking, now, ENDING_SOON_MS)
    ) {
      return false;
    }
    // Mark first so a notification failure cannot cause repeated sends.
    await this.patchBooking(bookingId, {
      end_reminder_sent_at: new Date().toISOString(),
    });
    await this.notificationsService.sendRentalEndingSoonNotifications({
      bookingId,
      rentalItemName:
        booking.rental_location_listing?.rental_item?.name ?? 'Rental',
      endAt: bookingReturnDueAt(booking) ?? booking.end_at,
      clientUserId: booking.client.user_id,
      businessUserId: booking.business.user_id,
    });
    return true;
  }

  async expireProposedRentalContracts(): Promise<number> {
    const now = new Date().toISOString();
    const res = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{ id: string; rental_request_id: string }>;
    }>(Q.LIST_EXPIRED_PROPOSED_RENTAL_BOOKINGS, { now });
    const rows = res.rental_bookings ?? [];
    for (const b of rows) {
      try {
        await this.expireOneProposedContract(b.id, b.rental_request_id);
      } catch (error: any) {
        this.logger.error(`expireProposedRentalContracts ${b.id}: ${error.message}`);
      }
    }
    return rows.length;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleReturnReportEscalations(): Promise<void> {
    try {
      const n = await this.renterReturns.escalateDue();
      if (n > 0) this.logger.log(`Escalated ${n} unconfirmed renter return report(s)`);
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleInspectionReviews(): Promise<void> {
    try {
      const reviewed = await this.inspections.remindAndEscalate();
      const settled = await this.rentalsService.sweepEnrolledSettlements();
      if (reviewed + settled > 0) {
        this.logger.log(`Inspection reviews ${reviewed}, settlement sweep ${settled}`);
      }
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  /**
   * Release reserved (pay-at-pickup) bookings that were never paid within the
   * grace window after their scheduled start, so the capacity frees up.
   * An open pickup inspection pauses that clock until the client accepts.
   */
  async expireReservedRentalBookings(): Promise<number> {
    // start_at is listing wall clock: widen, then unpaidReservationDue rechecks per listing.
    const now = wallClockHorizon(new Date());
    const res = await this.listExpiredReserved(now);
    let released = 0;
    for (const b of res.rental_bookings ?? []) {
      try {
        if (await this.expireOneReservedBooking(b.id)) released += 1;
      } catch (error: any) {
        this.logger.error(`expireReservedRentalBookings ${b.id}: ${error.message}`);
      }
    }
    return released;
  }

  private async listExpiredReserved(now: string) {
    try {
      return await this.hasuraSystemService.executeQuery<{
        rental_bookings: Array<{ id: string }>;
      }>(Q.LIST_EXPIRED_RESERVED_RENTAL_BOOKINGS, { now });
    } catch (error: any) {
      this.logger.warn(`reserved expiry using legacy predicate: ${error?.message ?? error}`);
      return this.hasuraSystemService.executeQuery<{
        rental_bookings: Array<{ id: string }>;
      }>(Q.LIST_EXPIRED_RESERVED_RENTAL_BOOKINGS_LEGACY, { now });
    }
  }

  private async expireOneReservedBooking(bookingId: string): Promise<boolean> {
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.status !== 'reserved' || booking.actual_start_at) return false;
    if (!this.rentalsService || !this.rentalsService.unpaidReservationDue(booking)) return false;
    const won = await casUpdateRentalBooking(
      this.hasuraSystemService,
      bookingId,
      ['reserved'],
      {
        status: 'cancelled',
        payment_status: 'cancelled',
        contract_expires_at: null,
      }
    );
    if (!won) return false;
    await this.logHistory(
      bookingId,
      'cancelled',
      'reserved',
      null,
      'system',
      'Reservation expired unpaid after scheduled start'
    );
    await this.notifyReservationExpired(booking);
    return true;
  }

  private async notifyReservationExpired(booking: any): Promise<void> {
    const rentalItemName =
      booking.rental_location_listing?.rental_item?.name ?? 'Rental';
    const recipients = [
      booking.client?.user_id,
      booking.business?.user_id,
    ].filter(Boolean) as string[];
    for (const recipientUserId of recipients) {
      try {
        await this.notificationsService.sendRentalBookingCancelledPush({
          recipientUserId,
          rentalItemName,
          bookingId: booking.id,
          bookingNumber: booking.booking_number ?? '',
          cancelledBy: 'system',
        });
      } catch (error: any) {
        this.logger.warn(`notifyReservationExpired: ${error.message}`);
      }
    }
  }

  private async expireOneProposedContract(
    bookingId: string,
    requestId: string
  ): Promise<void> {
    const won = await casUpdateRentalBooking(
      this.hasuraSystemService,
      bookingId,
      ['proposed'],
      { status: 'cancelled', contract_expires_at: null }
    );
    if (!won) return;
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_STATUS, {
      id: requestId,
      status: 'expired',
    });
    await this.logHistory(
      bookingId,
      'cancelled',
      'proposed',
      null,
      'system',
      'Rental contract expired'
    );
  }

  private async transitionActiveToAwaitingReturn(
    bookingId: string,
    nowIso: string
  ): Promise<boolean> {
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.status !== 'active') return false;
    const due = new Date(bookingReturnDueAt(booking) ?? NaN);
    if (!wallClockReached(due, new Date(nowIso), bookingZone(booking))) return false;
    const won = await casUpdateRentalBooking(
      this.hasuraSystemService,
      bookingId,
      ['active'],
      { status: 'awaiting_return', period_ended_notified_at: nowIso }
    );
    if (!won) return false;
    await this.logHistory(
      bookingId,
      'awaiting_return',
      'active',
      null,
      'system',
      'Rental period ended'
    );
    await this.notificationsService.sendRentalPeriodEndedEmails({
      bookingId,
      rentalItemName:
        booking.rental_location_listing?.rental_item?.name ?? 'Rental',
      endAt: bookingReturnDueAt(booking) ?? booking.end_at,
      clientUserId: booking.client.user_id,
      businessUserId: booking.business.user_id,
    });
    return true;
  }

  /**
   * end_at is listing wall clock, so the query widens by the largest UTC offset and
   * cancelNoShowBooking rechecks each row on its own listing clock.
   */
  async cancelNoShowBookings(): Promise<number> {
    const now = wallClockHorizon(new Date());
    const res = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{ id: string }>;
    }>(Q.LIST_RENTAL_NO_SHOWS, { now });
    let cancelled = 0;
    for (const row of res.rental_bookings ?? []) {
      if (await this.cancelOneNoShow(row.id)) cancelled += 1;
    }
    return cancelled;
  }

  private async cancelOneNoShow(bookingId: string): Promise<boolean> {
    try {
      return await this.rentalsService.cancelNoShowBooking(bookingId);
    } catch (error: any) {
      this.logger.error(`cancelNoShow ${bookingId}: ${error?.message ?? error}`);
      return false;
    }
  }

  async remindStartDayBookings(): Promise<number> {
    const now = new Date();
    const res = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{ id: string }>;
    }>(Q.LIST_RENTAL_START_DAY_CANDIDATES, {
      from: new Date(now.getTime() - 36 * 3600000).toISOString(),
      until: new Date(now.getTime() + 36 * 3600000).toISOString(),
    });
    let sent = 0;
    for (const row of res.rental_bookings ?? []) {
      sent += await this.remindOneStartDay(row.id, now);
    }
    return sent;
  }

  private async remindOneStartDay(bookingId: string, now: Date): Promise<number> {
    const booking = await this.fetchBooking(bookingId);
    if (!booking || !this.bookingIsStartDay(booking, now)) return 0;
    const item = booking.rental_location_listing?.rental_item?.name ?? 'Rental';
    const client = await this.pushStartDay(booking, booking.client?.user_id, item, 'client');
    const business = await this.pushStartDay(booking, booking.business?.user_id, item, 'business');
    return Number(client) + Number(business);
  }

  private bookingIsStartDay(booking: any, now: Date): boolean {
    const zone = bookingZone(booking);
    const startAt = new Date(booking.start_at);
    if (!isStartDay(startAt, now, zone)) return false;
    return wallClockReached(startOpensAt(startAt, zone), now, zone);
  }

  private async pushStartDay(
    booking: any,
    userId: string | undefined,
    item: string,
    persona: 'client' | 'business'
  ): Promise<boolean> {
    if (!userId) return false;
    try {
      return await this.notificationsService.sendRentalStartDayReminder({
        recipientUserId: userId,
        rentalItemName: item,
        bookingId: booking.id,
        persona,
      });
    } catch (error: any) {
      this.logger.warn(`start day ${booking.id}: ${error?.message ?? error}`);
      return false;
    }
  }

  private async fetchBooking(id: string) {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings_by_pk: any;
    }>(Q.GET_RENTAL_BOOKING_FULL, { id });
    return r.rental_bookings_by_pk;
  }

  private async patchBooking(id: string, _set: Record<string, unknown>) {
    await this.hasuraSystemService.executeMutation(
      `mutation PatchBooking($id: uuid!, $_set: rental_bookings_set_input!) {
        update_rental_bookings_by_pk(pk_columns: { id: $id }, _set: $_set) { id }
      }`,
      { id, _set }
    );
  }

  async expireUnansweredRentalRequests(now = new Date()): Promise<number> {
    const flags = await this.loadDashboardRequestFlags();
    return expireUnansweredRentalRequests({
      now,
      isEnabled: async () => flags.some((row) => row.boolean_value === true),
      listPending: () => this.listUnansweredRequests(flags, now),
      casDecline: (id, respondedAt) => this.casDeclineNoResponse(id, respondedAt),
      releaseHolds: (requestId) => this.rentalsService.releaseLinkedDeclineHold(requestId),
      notify: (row, window, recipients) => this.notifyNoResponse(row, window, recipients),
      listRetries: () => this.listSideEffects(),
      clearRetry: (id) => this.clearSideEffect(id),
      recordFailure: (row, kind, window, error) =>
        this.rentalsService.recordSideEffect(row.id, kind, error, {
          row,
          window,
          recipients: noResponseRecipients(error),
        }),
    });
  }

  private async loadDashboardRequestFlags(): Promise<DashboardRequestFlagRow[]> {
    const res = await this.hasuraSystemService.executeQuery<{
      application_configurations: DashboardRequestFlagRow[];
    }>(Q.DASHBOARD_REQUESTS_FLAG, {});
    return res.application_configurations ?? [];
  }

  private async listUnansweredRequests(
    flags: DashboardRequestFlagRow[],
    now: Date
  ): Promise<UnansweredRentalRequest[]> {
    const config = await this.loadExpiryConfig();
    const bounds = autodeclineBounds(now, config);
    const rows = await this.pageDueRequests(flags, config, now, bounds.limit);
    return rows.map((row) => this.toUnanswered(row));
  }

  private async pageDueRequests(
    flags: DashboardRequestFlagRow[],
    config: AutodeclineConfigRow[],
    now: Date,
    limit: number
  ): Promise<any[]> {
    const found: any[] = [];
    for (let offset = 0; offset < limit * 20 && found.length < limit; offset += limit) {
      const page = await this.fetchDuePage(flags, config, now, limit, offset);
      this.collectDue(found, page, flags, config, now, limit);
      if (page.length < limit) break;
    }
    return found;
  }

  private async fetchDuePage(
    flags: DashboardRequestFlagRow[],
    config: AutodeclineConfigRow[],
    now: Date,
    limit: number,
    offset: number
  ): Promise<any[]> {
    const where = pendingExpiryWhere(now, expiryClauses(flags, config, now));
    if (!where) return [];
    const res = await this.hasuraSystemService.executeQuery<{ rental_requests: any[] }>(
      Q.LIST_PENDING_RENTAL_REQUESTS_FOR_EXPIRY,
      { where, limit, offset }
    );
    return res.rental_requests ?? [];
  }

  private collectDue(
    found: any[],
    page: any[],
    flags: DashboardRequestFlagRow[],
    config: AutodeclineConfigRow[],
    now: Date,
    limit: number
  ): void {
    for (const row of page) {
      if (found.length >= limit) return;
      if (this.rowDue(flags, config, row, now)) found.push(row);
    }
  }

  private rowDue(
    flags: DashboardRequestFlagRow[],
    config: AutodeclineConfigRow[],
    row: any,
    now: Date
  ): boolean {
    const raw = row.rental_location_listing?.business_location?.address?.country ?? null;
    if (!listingDashboardFlag(flags, raw)) return false;
    const cutoff = cutoffForCountry(config, resolveItemCountry(raw), now);
    const decision = effectiveRespondBy({
      createdAt: row.created_at,
      respondBy: row.respond_by,
      startAt: earliestRequestStartIso(row),
      timeZone: listingZoneFor(raw),
    });
    return Date.parse(decision.respondBy) >= Date.parse(cutoff);
  }

  private async loadExpiryConfig(): Promise<AutodeclineConfigRow[]> {
    const res = await this.hasuraSystemService.executeQuery<{
      application_configurations: AutodeclineConfigRow[];
    }>(Q.DASHBOARD_REQUESTS_EXPIRY_CONFIG, {});
    return res.application_configurations ?? [];
  }

  private async listSideEffects(): Promise<SideEffectJob[]> {
    const res = await this.hasuraSystemService.executeQuery<{
      rental_request_side_effects: Array<{ id: string; kind: 'release' | 'notify'; payload: any }>;
    }>(Q.LIST_RENTAL_SIDE_EFFECTS, {});
    return (res.rental_request_side_effects ?? []).flatMap((row) => this.sideEffectJob(row));
  }

  private sideEffectJob(row: { id: string; kind: 'release' | 'notify'; payload: any }): SideEffectJob[] {
    const payload = row.payload ?? {};
    if (!payload.row?.id) return [];
    return [{
      id: row.id,
      kind: row.kind,
      row: payload.row,
      window: payload.window === 'start' ? 'start' : 'sla',
      recipients: listedRecipients(payload.recipients),
    }];
  }

  private async clearSideEffect(id: string): Promise<void> {
    await this.hasuraSystemService.executeMutation(Q.DELETE_RENTAL_SIDE_EFFECT, { id });
  }

  private toUnanswered(row: any): UnansweredRentalRequest {
    const user = row.client?.user;
    const item = row.rental_location_listing?.rental_item;
    return {
      id: row.id,
      created_at: row.created_at,
      respond_by: row.respond_by,
      requested_start_at: row.requested_start_at,
      rental_selection_windows: row.rental_selection_windows,
      clientUserId: row.client?.user_id ?? null,
      businessUserId: item?.business?.user_id ?? null,
      itemName: item?.name ?? 'Rental',
      businessName: item?.business?.name?.trim() || 'The business',
      renterName: [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim(),
      listingId: row.rental_location_listing?.id ?? '',
      timeZone: listingZoneFor(row.rental_location_listing?.business_location?.address?.country),
    };
  }

  private async casDeclineNoResponse(id: string, respondedAt: string): Promise<boolean> {
    const saved = await this.hasuraSystemService.executeMutation<{
      update_rental_requests: { affected_rows: number } | null;
    }>(Q.EXPIRE_RENTAL_REQUEST_NO_RESPONSE, { id, respondedAt });
    return (saved.update_rental_requests?.affected_rows ?? 0) > 0;
  }

  private async notifyNoResponse(
    row: UnansweredRentalRequest,
    window: RentalRespondWindow,
    recipients?: NoResponseRecipient[]
  ): Promise<void> {
    const failed = await this.notificationsService.failedNoResponseRecipients(
      { ...row, window },
      recipients
    );
    if (!failed.length) return;
    throw new Error(`NO_RESPONSE_PARTIAL:${failed.join(',')}`);
  }

  private async logHistory(
    bookingId: string,
    status: string,
    previous: string | null,
    userId: string | null,
    changedByType: string,
    notes: string
  ) {
    await this.hasuraSystemService.executeMutation(Q.INSERT_RENTAL_STATUS_HISTORY, {
      object: {
        rental_booking_id: bookingId,
        status,
        previous_status: previous,
        changed_by_user_id: userId,
        changed_by_type: changedByType,
        notes,
      },
    });
  }
}

const ENDING_SOON_MS = 30 * 60 * 1000;

/**
 * Upper bound for queries that filter wall-clock start_at / end_at with the real
 * clock: the latest wall-clock "now" any market can show. Rows are rechecked per listing.
 */
export function wallClockHorizon(now: Date): string {
  return new Date(now.getTime() + WALL_CLOCK_MAX_SKEW_MS).toISOString();
}

function bookingZone(booking: any): string {
  return listingZoneFor(booking?.rental_location_listing?.business_location?.address?.country);
}

/**
 * The return due (return_due_at after an hourly early start, else end_at; listing
 * wall clock) is after the listing's now and within `windowMs` of it.
 */
export function endsWithinOnListingClock(booking: any, now: Date, windowMs: number): boolean {
  const end = new Date(bookingReturnDueAt(booking) ?? NaN);
  const zone = bookingZone(booking);
  if (wallClockReached(end, now, zone)) return false;
  return wallClockReached(end, new Date(now.getTime() + windowMs), zone);
}
