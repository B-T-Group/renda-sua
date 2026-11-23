import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RentalInspectionService } from './inspection/rental-inspection.service';
import { RentalPickupDeclineService } from './pickup-decline/rental-pickup-decline.service';
import { RentalRenterReturnService } from './renter-return/rental-renter-return.service';
import { casUpdateRentalBooking } from './rental-booking-cas';
import { RentalsService } from './rentals.service';
import * as Q from './rentals-queries';
import { isStartDay, listingZoneFor, startOpensAt } from './simple-start/simple-start.policy';

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

  async processEndedActiveBookings(): Promise<number> {
    const now = new Date().toISOString();
    const res = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{ id: string }>;
    }>(Q.LIST_ACTIVE_BOOKINGS_PAST_END, { now });
    const rows = res.rental_bookings || [];
    for (const b of rows) {
      try {
        await this.transitionActiveToAwaitingReturn(b.id, now);
      } catch (error: any) {
        this.logger.error(`processEndedActiveBookings ${b.id}: ${error.message}`);
      }
    }
    return rows.length;
  }

  /** T−30m reminders to client + business; end_reminder_sent_at is the idempotency guard. */
  async sendEndingSoonReminders(): Promise<number> {
    const now = new Date();
    const res = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{ id: string }>;
    }>(Q.LIST_ACTIVE_BOOKINGS_ENDING_SOON, {
      now: now.toISOString(),
      until: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    });
    const rows = res.rental_bookings || [];
    for (const b of rows) {
      try {
        await this.remindOneEndingSoonBooking(b.id);
      } catch (error: any) {
        this.logger.error(`sendEndingSoonReminders ${b.id}: ${error.message}`);
      }
    }
    return rows.length;
  }

  private async remindOneEndingSoonBooking(bookingId: string): Promise<void> {
    const booking = await this.fetchBooking(bookingId);
    if (
      !booking ||
      booking.status !== 'active' ||
      booking.end_reminder_sent_at
    ) {
      return;
    }
    // Mark first so a notification failure cannot cause repeated sends.
    await this.patchBooking(bookingId, {
      end_reminder_sent_at: new Date().toISOString(),
    });
    await this.notificationsService.sendRentalEndingSoonNotifications({
      bookingId,
      rentalItemName:
        booking.rental_location_listing?.rental_item?.name ?? 'Rental',
      endAt: booking.end_at,
      clientUserId: booking.client.user_id,
      businessUserId: booking.business.user_id,
    });
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
    const now = new Date().toISOString();
    const res = await this.listExpiredReserved(now);
    const rows = res.rental_bookings ?? [];
    for (const b of rows) {
      try {
        await this.expireOneReservedBooking(b.id);
      } catch (error: any) {
        this.logger.error(`expireReservedRentalBookings ${b.id}: ${error.message}`);
      }
    }
    return rows.length;
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

  private async expireOneReservedBooking(bookingId: string): Promise<void> {
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.status !== 'reserved' || booking.actual_start_at) return;
    if (this.rentalsService && !this.rentalsService.unpaidReservationDue(booking)) return;
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
    if (!won) return;
    await this.logHistory(
      bookingId,
      'cancelled',
      'reserved',
      null,
      'system',
      'Reservation expired unpaid after scheduled start'
    );
    await this.notifyReservationExpired(booking);
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
  ): Promise<void> {
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.status !== 'active') return;
    const won = await casUpdateRentalBooking(
      this.hasuraSystemService,
      bookingId,
      ['active'],
      { status: 'awaiting_return', period_ended_notified_at: nowIso }
    );
    if (!won) return;
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
      endAt: booking.end_at,
      clientUserId: booking.client.user_id,
      businessUserId: booking.business.user_id,
    });
  }

  async cancelNoShowBookings(): Promise<number> {
    const now = new Date().toISOString();
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
    const zone = listingZoneFor(booking?.rental_location_listing?.business_location?.address?.country);
    const startAt = new Date(booking.start_at);
    if (!isStartDay(startAt, now, zone)) return false;
    return now.getTime() >= startOpensAt(startAt, zone).getTime();
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
