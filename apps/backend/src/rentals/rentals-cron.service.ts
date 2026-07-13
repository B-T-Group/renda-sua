import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as Q from './rentals-queries';

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
