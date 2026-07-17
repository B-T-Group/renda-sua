import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as Q from './rentals-queries';

/** Grace after the scheduled start before an unpaid reservation is released. */
const RESERVED_UNPAID_GRACE_MINUTES = 60;

/**
 * Singleton cron host for rental system jobs.
 * Must not inject request-scoped providers (e.g. HasuraUserService / RentalsService).
 */
@Injectable()
export class RentalsCronService {
  private readonly logger = new Logger(RentalsCronService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService
  ) {}

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

  /**
   * Release reserved (pay-at-pickup) bookings that were never paid within the
   * grace window after their scheduled start, so the capacity frees up.
   */
  async expireReservedRentalBookings(): Promise<number> {
    const cutoff = new Date(
      Date.now() - RESERVED_UNPAID_GRACE_MINUTES * 60 * 1000
    ).toISOString();
    const res = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{ id: string }>;
    }>(Q.LIST_EXPIRED_RESERVED_RENTAL_BOOKINGS, { cutoff });
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

  private async expireOneReservedBooking(bookingId: string): Promise<void> {
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.status !== 'reserved' || booking.actual_start_at) {
      return;
    }
    await this.patchBooking(bookingId, {
      status: 'cancelled',
      payment_status: 'cancelled',
      contract_expires_at: null,
    });
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
    await this.patchBooking(bookingId, {
      status: 'cancelled',
      contract_expires_at: null,
    });
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
    await this.patchBooking(bookingId, {
      status: 'awaiting_return',
      period_ended_notified_at: nowIso,
    });
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
