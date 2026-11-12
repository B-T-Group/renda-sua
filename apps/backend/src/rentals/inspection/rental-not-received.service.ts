import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { isActivePersona } from '../../users/persona.util';
import { assertCanReportNotReceived } from './rental-not-received.policy';

export interface NotReceivedReportResult {
  success: true;
  alreadyReported: boolean;
  report: {
    id: string;
    rentalBookingId: string;
    reportedAt: string;
  };
}

interface ReportRow {
  id: string;
  rental_booking_id: string;
  reported_at: string;
}

interface NotReceivedBooking {
  id: string;
  booking_number: string | null;
  client_id: string;
  status: string;
  inspection_policy_version: number | null;
  actual_start_at: string | null;
  business?: { user_id?: string | null } | null;
  rental_location_listing?: { rental_item?: { name?: string | null } | null } | null;
}

const BOOKING = `
  query NotReceivedBooking($id: uuid!) {
    rental_bookings_by_pk(id: $id) {
      id
      booking_number
      client_id
      status
      inspection_policy_version
      actual_start_at
      business { user_id }
      rental_location_listing { rental_item { name } }
    }
  }
`;

const FIND_REPORT = `
  query FindNotReceived($id: uuid!) {
    rental_not_received_reports(where: { rental_booking_id: { _eq: $id } }, limit: 1) {
      id
      rental_booking_id
      reported_at
    }
  }
`;

const INSERT_REPORT = `
  mutation InsertNotReceived($object: rental_not_received_reports_insert_input!) {
    insert_rental_not_received_reports(
      objects: [$object]
      on_conflict: {
        constraint: rental_not_received_reports_booking_uidx
        update_columns: []
      }
    ) {
      returning { id rental_booking_id reported_at }
    }
  }
`;

const LIST_REPORTS = `
  query ListNotReceived {
    rental_not_received_reports(order_by: { reported_at: desc }, limit: 50) {
      id
      rental_booking_id
      reported_at
      rental_booking {
        booking_number
        status
        rental_location_listing { rental_item { name } }
      }
    }
  }
`;

@Injectable()
export class RentalNotReceivedService {
  constructor(
    private readonly users: HasuraUserService,
    private readonly hasura: HasuraSystemService,
    private readonly notifications: NotificationsService
  ) {}

  async report(bookingId: string, now = new Date()): Promise<NotReceivedReportResult> {
    const actor = await this.requireRenter(bookingId);
    const prior = await this.findReport(bookingId);
    if (prior) return this.present(prior, true);
    assertCanReportNotReceived(actor.booking, now);
    const created = await this.insertReport(bookingId, actor.userId);
    if (!created) return this.present(await this.requireReport(bookingId), true);
    await this.notify(actor.booking);
    return this.present(created, false);
  }

  async findForBooking(bookingId: string): Promise<ReportRow | null> {
    try {
      return await this.findReport(bookingId);
    } catch {
      return null;
    }
  }

  async listForAdmin(): Promise<Array<Record<string, unknown>>> {
    const result = await this.hasura.executeQuery<{
      rental_not_received_reports: Array<Record<string, unknown>>;
    }>(LIST_REPORTS, {});
    return result.rental_not_received_reports ?? [];
  }

  private async requireRenter(bookingId: string) {
    const user = await this.users.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException('Only the renter can report this', HttpStatus.FORBIDDEN);
    }
    const booking = await this.loadBooking(bookingId);
    if (!booking || booking.client_id !== user.client.id) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    return { booking, userId: user.id as string };
  }

  private async loadBooking(bookingId: string): Promise<NotReceivedBooking | null> {
    const result = await this.hasura.executeQuery<{
      rental_bookings_by_pk: NotReceivedBooking | null;
    }>(BOOKING, { id: bookingId });
    return result.rental_bookings_by_pk ?? null;
  }

  private async findReport(bookingId: string): Promise<ReportRow | null> {
    const result = await this.hasura.executeQuery<{
      rental_not_received_reports: ReportRow[];
    }>(FIND_REPORT, { id: bookingId });
    return result.rental_not_received_reports?.[0] ?? null;
  }

  private async insertReport(bookingId: string, userId: string): Promise<ReportRow | null> {
    try {
      const result = await this.hasura.executeMutation<{
        insert_rental_not_received_reports?: { returning: ReportRow[] };
      }>(INSERT_REPORT, {
        object: { rental_booking_id: bookingId, reported_by_user_id: userId },
      });
      return result.insert_rental_not_received_reports?.returning?.[0] ?? null;
    } catch (error: any) {
      if (this.alreadyStored(error)) return null;
      throw error;
    }
  }

  private async requireReport(bookingId: string): Promise<ReportRow> {
    const row = await this.findReport(bookingId);
    if (!row) throw new HttpException('Try again', HttpStatus.CONFLICT);
    return row;
  }

  private async notify(booking: NotReceivedBooking): Promise<void> {
    const item = booking.rental_location_listing?.rental_item?.name ?? 'Rental';
    await this.notifications.sendBusinessRentalNotReceived({
      businessUserId: booking.business?.user_id ?? '',
      bookingId: booking.id,
    });
    await this.notifications.notifySupportRentalNotReceived({
      bookingId: booking.id,
      bookingNumber: booking.booking_number ?? booking.id,
      rentalItemName: item,
    });
  }

  private present(row: ReportRow, alreadyReported: boolean): NotReceivedReportResult {
    return {
      success: true,
      alreadyReported,
      report: {
        id: row.id,
        rentalBookingId: row.rental_booking_id,
        reportedAt: row.reported_at,
      },
    };
  }

  private alreadyStored(error: any): boolean {
    const text = JSON.stringify(error?.response ?? error?.message ?? error);
    return text.includes('Uniqueness violation') || text.includes('duplicate key');
  }
}
