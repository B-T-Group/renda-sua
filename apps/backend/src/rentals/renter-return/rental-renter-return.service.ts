import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../app-config/app-config.service';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { isActivePersona } from '../../users/persona.util';
import { RentalInspectionService } from '../inspection/rental-inspection.service';
import { RentalsService } from '../rentals.service';
import {
  returnAlreadyConfirmed,
  returnNotEscalated,
  returnReportDisabled,
} from './rental-renter-return.errors';
import { assertCanReportReturn, escalationCutoff } from './rental-renter-return.policy';

export interface ReturnReportResult {
  success: true;
  alreadyReported: boolean;
  wasOverdue: boolean;
  report: { rentalBookingId: string; reportedAt: string };
}

export interface ReturnPlace {
  name: string;
  address: string | null;
  phone: string | null;
}

interface ReturnBooking {
  id: string;
  booking_number: string | null;
  client_id: string;
  status: string;
  actual_start_at: string | null;
  end_at: string | null;
  renter_reported_returned_at: string | null;
  renter_return_escalated_at: string | null;
  inspection_policy_version: number | null;
  business?: { user_id?: string | null } | null;
  rental_location_listing?: {
    rental_item?: { name?: string | null } | null;
    business_location?: { address?: { country?: string | null } | null } | null;
  } | null;
}

const BOOKING = `
  query ReturnReportBooking($id: uuid!) {
    rental_bookings_by_pk(id: $id) {
      id booking_number client_id status actual_start_at end_at
      renter_reported_returned_at renter_return_escalated_at inspection_policy_version
      business { user_id }
      rental_location_listing {
        rental_item { name }
        business_location { address { country } }
      }
    }
  }
`;

const STAMP = `
  mutation StampRenterReturn($id: uuid!, $at: timestamptz!) {
    update_rental_bookings(
      where: {
        id: { _eq: $id }
        renter_reported_returned_at: { _is_null: true }
        status: { _in: ["active", "awaiting_return"] }
        actual_start_at: { _is_null: false }
      }
      _set: { renter_reported_returned_at: $at }
    ) {
      returning { id }
    }
  }
`;

const CLAIM = `
  mutation ClaimReturnEscalations($cutoff: timestamptz!, $now: timestamptz!) {
    update_rental_bookings(
      where: {
        renter_reported_returned_at: { _lte: $cutoff }
        renter_return_escalated_at: { _is_null: true }
        status: { _in: ["active", "awaiting_return"] }
      }
      _set: { renter_return_escalated_at: $now }
    ) {
      returning {
        id booking_number renter_reported_returned_at
        rental_location_listing { rental_item { name } }
      }
    }
  }
`;

const LIST = `
  query OpenReturnReports {
    rental_bookings(
      where: {
        renter_reported_returned_at: { _is_null: false }
        status: { _in: ["active", "awaiting_return"] }
      }
      order_by: { renter_reported_returned_at: asc }
      limit: 50
    ) {
      id booking_number status end_at security_deposit_amount currency
      renter_reported_returned_at renter_return_escalated_at inspection_policy_version
      rental_location_listing {
        rental_item { name }
        business_location { name }
      }
    }
  }
`;

const PLACE = `
  query ReturnPlace($id: uuid!) {
    rental_bookings_by_pk(id: $id) {
      business { user { phone_number } }
      rental_location_listing {
        business_location {
          name
          address { address_line_1 address_line_2 city state country }
        }
      }
    }
  }
`;

@Injectable()
export class RentalRenterReturnService {
  constructor(
    private readonly users: HasuraUserService,
    private readonly hasura: HasuraSystemService,
    private readonly notifications: NotificationsService,
    private readonly flags: AppConfigService,
    private readonly rentals: RentalsService,
    private readonly inspections: RentalInspectionService
  ) {}

  async report(bookingId: string, now = new Date()): Promise<ReturnReportResult> {
    const actor = await this.requireRenter(bookingId);
    if (!(await this.flagOn(actor.booking))) throw returnReportDisabled();
    if (actor.booking.status === 'completed') throw returnAlreadyConfirmed();
    if (actor.booking.renter_reported_returned_at) return this.present(actor.booking, true);
    assertCanReportReturn(actor.booking, now);
    const stamped = await this.stamp(bookingId, now);
    if (!stamped) return this.afterLostStamp(bookingId);
    await this.notifyBusiness(actor.booking);
    return this.present({ ...actor.booking, renter_reported_returned_at: now.toISOString() }, false);
  }

  async escalateDue(now = new Date()): Promise<number> {
    const rows = await this.claimEscalations(escalationCutoff(now), now.toISOString());
    for (const row of rows) await this.notifySupport(row);
    return rows.length;
  }

  async listForAdmin(): Promise<Array<Record<string, unknown>>> {
    const result = await this.hasura.executeQuery<{
      rental_bookings: Array<Record<string, unknown>>;
    }>(LIST, {});
    return result.rental_bookings ?? [];
  }

  async confirmAsSupport(bookingId: string, actorId: string, reason: string) {
    const note = reason?.trim();
    if (!note) throw new HttpException('A reason is required', HttpStatus.BAD_REQUEST);
    const booking = await this.loadBooking(bookingId);
    if (!booking) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    if (booking.status === 'completed') throw returnAlreadyConfirmed();
    if (!booking.renter_return_escalated_at) throw returnNotEscalated();
    return this.confirmEscalated(booking, actorId, note);
  }

  async placeFor(bookingId: string): Promise<ReturnPlace | null> {
    try {
      return this.readPlace(await this.loadPlace(bookingId));
    } catch {
      return null;
    }
  }

  private async confirmEscalated(booking: ReturnBooking, actorId: string, note: string) {
    if (booking.inspection_policy_version != null) {
      return this.inspections.recordHandbackAsAdmin(booking.id, actorId, note);
    }
    return this.rentals.confirmLegacyReturnForSupport(booking.id, actorId, note);
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

  private async flagOn(booking: ReturnBooking): Promise<boolean> {
    const country = booking.rental_location_listing?.business_location?.address?.country ?? undefined;
    const flags = await this.flags.getClientFlags(country ?? undefined);
    return flags.rentals_renter_return_report_enabled === true;
  }

  private async loadBooking(bookingId: string): Promise<ReturnBooking | null> {
    const result = await this.hasura.executeQuery<{ rental_bookings_by_pk: ReturnBooking | null }>(
      BOOKING,
      { id: bookingId }
    );
    return result.rental_bookings_by_pk ?? null;
  }

  private async stamp(bookingId: string, now: Date): Promise<boolean> {
    const result = await this.hasura.executeMutation<{
      update_rental_bookings?: { returning: Array<{ id: string }> };
    }>(STAMP, { id: bookingId, at: now.toISOString() });
    return (result.update_rental_bookings?.returning?.length ?? 0) > 0;
  }

  private async afterLostStamp(bookingId: string): Promise<ReturnReportResult> {
    const fresh = await this.loadBooking(bookingId);
    if (fresh?.status === 'completed') throw returnAlreadyConfirmed();
    if (fresh?.renter_reported_returned_at) return this.present(fresh, true);
    throw new HttpException('Try again', HttpStatus.CONFLICT);
  }

  private async notifyBusiness(booking: ReturnBooking): Promise<void> {
    await this.notifications.sendBusinessRenterReturned({
      businessUserId: booking.business?.user_id ?? '',
      bookingId: booking.id,
      bookingNumber: booking.booking_number ?? booking.id,
      rentalItemName: booking.rental_location_listing?.rental_item?.name ?? 'Rental',
    });
  }

  private present(booking: ReturnBooking, alreadyReported: boolean): ReturnReportResult {
    const reportedAt = booking.renter_reported_returned_at ?? '';
    const end = booking.end_at ? new Date(booking.end_at).getTime() : Number.NaN;
    const at = new Date(reportedAt).getTime();
    return {
      success: true,
      alreadyReported,
      wasOverdue: Number.isFinite(end) && Number.isFinite(at) && at > end,
      report: { rentalBookingId: booking.id, reportedAt },
    };
  }

  private async claimEscalations(cutoff: string, now: string) {
    const result = await this.hasura.executeMutation<{
      update_rental_bookings?: {
        returning: Array<{
          id: string;
          booking_number: string | null;
          renter_reported_returned_at: string;
          rental_location_listing?: { rental_item?: { name?: string | null } | null } | null;
        }>;
      };
    }>(CLAIM, { cutoff, now });
    return result.update_rental_bookings?.returning ?? [];
  }

  private async notifySupport(row: {
    id: string;
    booking_number: string | null;
    rental_location_listing?: { rental_item?: { name?: string | null } | null } | null;
  }): Promise<void> {
    await this.notifications.notifySupportRenterReturnUnconfirmed({
      bookingId: row.id,
      bookingNumber: row.booking_number ?? row.id,
      rentalItemName: row.rental_location_listing?.rental_item?.name ?? 'Rental',
    });
  }

  private async loadPlace(bookingId: string) {
    const result = await this.hasura.executeQuery<{ rental_bookings_by_pk: PlaceRow | null }>(
      PLACE,
      { id: bookingId }
    );
    return result.rental_bookings_by_pk;
  }

  private readPlace(row: PlaceRow | null): ReturnPlace | null {
    const location = row?.rental_location_listing?.business_location;
    if (!location?.name) return null;
    const address = [location.address?.address_line_1, location.address?.address_line_2, location.address?.city, location.address?.state, location.address?.country]
      .filter((part) => !!part?.trim())
      .join(', ');
    return {
      name: location.name,
      address: address || null,
      phone: row?.business?.user?.phone_number?.trim() || null,
    };
  }
}

interface PlaceRow {
  business?: { user?: { phone_number?: string | null } | null } | null;
  rental_location_listing?: {
    business_location?: {
      name?: string | null;
      address?: {
        address_line_1?: string | null;
        address_line_2?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
      } | null;
    } | null;
  } | null;
}
