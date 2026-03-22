import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { AccountsService } from '../accounts/accounts.service';
import { DeliveryPinService } from '../orders/delivery-pin.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBusinessRentalItemDto } from './dto/create-business-rental-item.dto';
import { CreateBusinessRentalListingDto } from './dto/create-business-rental-listing.dto';
import { CreateRentalBookingDto } from './dto/create-rental-booking.dto';
import { CreateRentalRequestDto } from './dto/create-rental-request.dto';
import {
  RespondRentalRequestDto,
  RespondRentalRequestStatusDto,
} from './dto/respond-rental-request.dto';
import {
  isValidRentalPricingSnapshot,
  RentalPricingSnapshotDto,
} from './dto/rental-pricing-snapshot.dto';
import { VerifyRentalStartPinDto } from './dto/verify-rental-start-pin.dto';
import * as Q from './rentals-queries';

function rentalDayCount(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

@Injectable()
export class RentalsService {
  private readonly logger = new Logger(RentalsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly accountsService: AccountsService,
    private readonly deliveryPinService: DeliveryPinService,
    private readonly notificationsService: NotificationsService
  ) {}

  async createRentalRequest(dto: CreateRentalRequestDto) {
    const user = await this.hasuraUserService.getUser();
    if (!user.client) {
      throw new HttpException('Only clients can create requests', HttpStatus.FORBIDDEN);
    }
    const start = new Date(dto.requestedStartAt);
    const end = new Date(dto.requestedEndAt);
    if (!(end > start)) {
      throw new HttpException('End must be after start', HttpStatus.BAD_REQUEST);
    }
    const listing = await this.fetchListing(dto.rentalLocationListingId);
    this.assertListingBookable(listing);
    const days = rentalDayCount(start, end);
    this.assertDuration(listing, days);
    await this.assertCapacity(listing.id, start, end, listing.units_available);
    const row = await this.hasuraSystemService.executeMutation<{
      insert_rental_requests_one: { id: string };
    }>(Q.INSERT_RENTAL_REQUEST, {
      object: {
        client_id: user.client.id,
        rental_location_listing_id: listing.id,
        requested_start_at: dto.requestedStartAt,
        requested_end_at: dto.requestedEndAt,
        status: 'pending',
      },
    });
    return { success: true, requestId: row.insert_rental_requests_one.id };
  }

  async respondToRentalRequest(requestId: string, dto: RespondRentalRequestDto) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business) {
      throw new HttpException('Only businesses can respond', HttpStatus.FORBIDDEN);
    }
    const req = await this.fetchRequest(requestId);
    if (req.status !== 'pending') {
      throw new HttpException('Request is not pending', HttpStatus.BAD_REQUEST);
    }
    if (req.rental_location_listing.rental_item.business_id !== user.business.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    if (dto.status === RespondRentalRequestStatusDto.available) {
      if (!dto.rentalPricingSnapshot || !isValidRentalPricingSnapshot(dto.rentalPricingSnapshot)) {
        throw new HttpException(
          'rentalPricingSnapshot is required when available',
          HttpStatus.BAD_REQUEST
        );
      }
      this.assertSnapshotCurrency(dto.rentalPricingSnapshot, req);
    }
    const snapshot =
      dto.status === RespondRentalRequestStatusDto.available
        ? dto.rentalPricingSnapshot
        : null;
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_RESPOND, {
      id: requestId,
      status: dto.status,
      snapshot,
      note: dto.businessResponseNote ?? null,
      respondedAt: new Date().toISOString(),
      userId: user.id,
    });
    return { success: true };
  }

  async getBusinessRentalItems(): Promise<any[]> {
    await this.requireBusinessId();
    const r = await this.hasuraUserService.executeQuery<{
      rental_items: any[];
    }>(Q.GET_BUSINESS_RENTAL_ITEMS, {});
    return r.rental_items ?? [];
  }

  async getBusinessRentalRequests(): Promise<any[]> {
    await this.requireBusinessId();
    const r = await this.hasuraUserService.executeQuery<{
      rental_requests: any[];
    }>(Q.GET_BUSINESS_RENTAL_REQUESTS, {});
    return r.rental_requests ?? [];
  }

  async createBusinessRentalItem(dto: CreateBusinessRentalItemDto): Promise<string> {
    const businessId = await this.requireBusinessId();
    const row = await this.hasuraUserService.executeMutation<{
      insert_rental_items_one: { id: string } | null;
    }>(Q.INSERT_BUSINESS_RENTAL_ITEM, {
      object: {
        business_id: businessId,
        rental_category_id: dto.rental_category_id,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        tags: dto.tags ?? [],
        currency: dto.currency?.trim() || 'XAF',
        operation_mode: 'business_operated',
        is_active: true,
      },
    });
    const id = row.insert_rental_items_one?.id;
    if (!id) {
      throw new HttpException(
        'Failed to create rental item',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return id;
  }

  async createBusinessRentalListing(
    dto: CreateBusinessRentalListingDto
  ): Promise<string> {
    const businessId = await this.requireBusinessId();
    await this.assertRentalItemForBusiness(dto.rental_item_id, businessId);
    await this.assertLocationForBusiness(dto.business_location_id, businessId);
    const minDays = dto.min_rental_days ?? 1;
    const maxDays =
      dto.max_rental_days === undefined ? null : dto.max_rental_days;
    if (maxDays != null && maxDays < minDays) {
      throw new HttpException(
        'max_rental_days must be >= min_rental_days',
        HttpStatus.BAD_REQUEST
      );
    }
    const price = Number(dto.base_price_per_day);
    if (Number.isNaN(price) || price < 0) {
      throw new HttpException('Invalid base_price_per_day', HttpStatus.BAD_REQUEST);
    }
    const row = await this.hasuraUserService.executeMutation<{
      insert_rental_location_listings_one: { id: string } | null;
    }>(Q.INSERT_BUSINESS_RENTAL_LISTING, {
      object: {
        rental_item_id: dto.rental_item_id,
        business_location_id: dto.business_location_id,
        pickup_instructions: dto.pickup_instructions?.trim() ?? '',
        dropoff_instructions: dto.dropoff_instructions?.trim() ?? '',
        base_price_per_day: price,
        min_rental_days: minDays,
        max_rental_days: maxDays,
        units_available: dto.units_available ?? 1,
        is_active: true,
      },
    });
    const id = row.insert_rental_location_listings_one?.id;
    if (!id) {
      throw new HttpException(
        'Failed to create listing',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return id;
  }

  private async requireBusinessId(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    const id = user?.business?.id;
    if (!id) {
      throw new HttpException(
        { success: false, error: 'Business profile required' },
        HttpStatus.FORBIDDEN
      );
    }
    return id;
  }

  private async assertRentalItemForBusiness(
    itemId: string,
    businessId: string
  ): Promise<void> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_items_by_pk: { business_id: string } | null;
    }>(Q.GET_RENTAL_ITEM_BUSINESS_CHECK, { id: itemId });
    const row = r.rental_items_by_pk;
    if (!row || row.business_id !== businessId) {
      throw new HttpException('Rental item not found', HttpStatus.NOT_FOUND);
    }
  }

  private async assertLocationForBusiness(
    locationId: string,
    businessId: string
  ): Promise<void> {
    const r = await this.hasuraSystemService.executeQuery<{
      business_locations_by_pk: { business_id: string } | null;
    }>(Q.GET_BUSINESS_LOCATION_OWNER, { id: locationId });
    const row = r.business_locations_by_pk;
    if (!row || row.business_id !== businessId) {
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
    }
  }

  async createRentalBooking(dto: CreateRentalBookingDto) {
    const user = await this.hasuraUserService.getUser();
    if (!user.client) {
      throw new HttpException('Only clients can book', HttpStatus.FORBIDDEN);
    }
    const req = await this.fetchRequest(dto.rentalRequestId);
    if (req.client_id !== user.client.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    if (req.status !== 'available') {
      throw new HttpException('Request is not available for booking', HttpStatus.BAD_REQUEST);
    }
    if (!req.rental_pricing_snapshot || !isValidRentalPricingSnapshot(req.rental_pricing_snapshot)) {
      throw new HttpException('Invalid pricing on request', HttpStatus.BAD_REQUEST);
    }
    const start = new Date(req.requested_start_at);
    const end = new Date(req.requested_end_at);
    await this.assertCapacity(
      req.rental_location_listing_id,
      start,
      end,
      req.rental_location_listing.units_available
    );
    const snap = req.rental_pricing_snapshot as RentalPricingSnapshotDto;
    const total = Number(snap.total);
    const bookingRow = await this.insertBookingRow(req, user.client.id, snap, total);
    const bookingId = bookingRow.insert_rental_bookings_one.id;
    try {
      await this.placeHoldForBooking(bookingId, user.client.id, total, snap.currency);
    } catch (e: any) {
      await this.deleteBooking(bookingId);
      throw new HttpException(e.message || 'Hold failed', HttpStatus.BAD_REQUEST);
    }
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_STATUS, {
      id: dto.rentalRequestId,
      status: 'booked',
    });
    const pin = this.deliveryPinService.generatePin();
    const hash = this.deliveryPinService.hashPin(bookingId, pin);
    await this.setBookingPinHash(bookingId, hash);
    this.deliveryPinService.setPinForClient(bookingId, pin);
    await this.logHistory(bookingId, 'confirmed', null, user.id, 'client', 'Booking created');
    return { success: true, bookingId };
  }

  async cancelRentalBooking(bookingId: string) {
    const user = await this.hasuraUserService.getUser();
    const booking = await this.fetchBooking(bookingId);
    if (!booking) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }
    const isClient = user.client?.id === booking.client_id;
    const isBusiness = user.business?.id === booking.business_id;
    if (!isClient && !isBusiness) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    if (booking.status !== 'confirmed') {
      throw new HttpException('Only confirmed bookings can be cancelled this way', HttpStatus.BAD_REQUEST);
    }
    await this.releaseHoldIfNeeded(bookingId, booking);
    await this.updateBookingStatus(bookingId, 'cancelled');
    await this.logHistory(bookingId, 'cancelled', 'confirmed', user.id, isClient ? 'client' : 'business', 'Cancelled');
    this.deliveryPinService.clearPinForOrder(bookingId);
    return { success: true };
  }

  async getStartPinForClient(bookingId: string) {
    const user = await this.hasuraUserService.getUser();
    if (!user.client) {
      throw new HttpException('Only clients can get the start PIN', HttpStatus.FORBIDDEN);
    }
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.client_id !== user.client.id) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    if (booking.status !== 'confirmed') {
      throw new HttpException('PIN only for confirmed bookings', HttpStatus.GONE);
    }
    let pin = this.deliveryPinService.getPinForClient(bookingId);
    if (!pin) {
      pin = this.deliveryPinService.generatePin();
      const h = this.deliveryPinService.hashPin(bookingId, pin);
      await this.setBookingPinHash(bookingId, h);
      await this.resetPinAttempts(bookingId);
      this.deliveryPinService.setPinForClient(bookingId, pin);
    }
    return { pin };
  }

  async verifyRentalStartPin(bookingId: string, body: VerifyRentalStartPinDto) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business) {
      throw new HttpException('Only businesses can verify', HttpStatus.FORBIDDEN);
    }
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.business_id !== user.business.id) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    if (booking.status !== 'confirmed') {
      throw new HttpException('Invalid booking status', HttpStatus.BAD_REQUEST);
    }
    const hasPin = !!body.pin?.trim();
    const hasOw = !!body.overwriteCode?.trim();
    if (!hasPin && !hasOw) {
      throw new HttpException('pin or overwriteCode required', HttpStatus.BAD_REQUEST);
    }
    if (hasOw) {
      await this.verifyOverwrite(bookingId, booking, body.overwriteCode!.trim());
    } else {
      await this.verifyPinAttempt(bookingId, booking, body.pin!.trim());
    }
    const now = new Date().toISOString();
    await this.patchBooking(bookingId, {
      status: 'active',
      actual_start_at: now,
    });
    await this.logHistory(bookingId, 'active', 'confirmed', user.id, 'business', 'Start PIN verified');
    return { success: true };
  }

  async generateStartOverwriteCode(bookingId: string) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business) {
      throw new HttpException('Only businesses', HttpStatus.FORBIDDEN);
    }
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.business_id !== user.business.id) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    if (booking.status !== 'confirmed') {
      throw new HttpException('Invalid status', HttpStatus.BAD_REQUEST);
    }
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const hash = this.deliveryPinService.hashOverwriteCode(bookingId, code);
    await this.patchBooking(bookingId, { rental_start_overwrite_code_hash: hash });
    return { overwriteCode: code };
  }

  async confirmRentalReturn(bookingId: string) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business) {
      throw new HttpException('Only businesses', HttpStatus.FORBIDDEN);
    }
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.business_id !== user.business.id) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    if (booking.status !== 'awaiting_return') {
      throw new HttpException('Booking is not awaiting return', HttpStatus.BAD_REQUEST);
    }
    await this.settleBooking(booking);
    await this.updateBookingStatus(bookingId, 'completed');
    await this.logHistory(
      bookingId,
      'completed',
      'awaiting_return',
      user.id,
      'business',
      'Return confirmed'
    );
    this.deliveryPinService.clearPinForOrder(bookingId);
    return { success: true };
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

  private async transitionActiveToAwaitingReturn(bookingId: string, nowIso: string) {
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.status !== 'active') {
      return;
    }
    await this.patchBooking(bookingId, {
      status: 'awaiting_return',
      period_ended_notified_at: nowIso,
    });
    await this.logHistory(bookingId, 'awaiting_return', 'active', null, 'system', 'Rental period ended');
    await this.notificationsService.sendRentalPeriodEndedEmails({
      bookingId,
      rentalItemName: booking.rental_location_listing?.rental_item?.name ?? 'Rental',
      endAt: booking.end_at,
      clientUserId: booking.client.user_id,
      businessUserId: booking.business.user_id,
    });
  }

  private async fetchListing(id: string) {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings_by_pk: any;
    }>(Q.GET_LISTING_FOR_REQUEST, { id });
    return r.rental_location_listings_by_pk;
  }

  private assertListingBookable(listing: any) {
    if (!listing?.is_active || !listing.rental_item?.is_active) {
      throw new HttpException('Listing not available', HttpStatus.BAD_REQUEST);
    }
    if (!listing.rental_item?.business?.is_verified) {
      throw new HttpException('Business not verified', HttpStatus.BAD_REQUEST);
    }
  }

  private assertDuration(listing: any, days: number) {
    if (days < listing.min_rental_days) {
      throw new HttpException('Below minimum rental days', HttpStatus.BAD_REQUEST);
    }
    if (listing.max_rental_days != null && days > listing.max_rental_days) {
      throw new HttpException('Above maximum rental days', HttpStatus.BAD_REQUEST);
    }
  }

  private assertSnapshotCurrency(snap: RentalPricingSnapshotDto, req: any) {
    const itemCurrency = req.rental_location_listing.rental_item.currency;
    if (snap.currency !== itemCurrency) {
      throw new HttpException('Snapshot currency must match listing currency', HttpStatus.BAD_REQUEST);
    }
  }

  private async assertCapacity(
    listingId: string,
    start: Date,
    end: Date,
    units: number
  ) {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings_aggregate: { aggregate: { count: number } };
    }>(Q.COUNT_OVERLAPPING_BOOKINGS, {
      listingId,
      start: start.toISOString(),
      end: end.toISOString(),
    });
    const count = r.rental_bookings_aggregate?.aggregate?.count ?? 0;
    if (count >= units) {
      throw new HttpException('No units available for these dates', HttpStatus.CONFLICT);
    }
  }

  private async fetchRequest(id: string) {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_requests_by_pk: any;
    }>(Q.GET_RENTAL_REQUEST_FULL, { id });
    const req = r.rental_requests_by_pk;
    if (!req) {
      throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
    }
    return req;
  }

  private async insertBookingRow(
    req: any,
    clientId: string,
    snap: RentalPricingSnapshotDto,
    total: number
  ) {
    return this.hasuraSystemService.executeMutation<{
      insert_rental_bookings_one: { id: string };
    }>(Q.INSERT_RENTAL_BOOKING, {
      object: {
        rental_request_id: req.id,
        client_id: clientId,
        business_id: req.rental_location_listing.rental_item.business_id,
        rental_location_listing_id: req.rental_location_listing_id,
        start_at: req.requested_start_at,
        end_at: req.requested_end_at,
        total_amount: total,
        currency: snap.currency,
        rental_pricing_snapshot: snap,
        status: 'confirmed',
      },
    });
  }

  private async placeHoldForBooking(
    bookingId: string,
    clientId: string,
    total: number,
    currency: string
  ) {
    const clientRow = await this.hasuraSystemService.executeQuery<{
      clients_by_pk: { user_id: string };
    }>(
      `query ClientUser($id: uuid!) { clients_by_pk(id: $id) { user_id } }`,
      { id: clientId }
    );
    const userId = clientRow.clients_by_pk?.user_id;
    if (!userId) {
      throw new Error('Client user not found');
    }
    const account = await this.hasuraSystemService.getAccount(userId, currency);
    const hold = await this.accountsService.registerTransaction({
      accountId: account.id,
      amount: total,
      transactionType: 'hold',
      memo: `Rental hold for booking ${bookingId}`,
      referenceId: bookingId,
    });
    if (!hold.success) {
      throw new Error(hold.error || 'Hold failed');
    }
    await this.hasuraSystemService.executeMutation(Q.INSERT_RENTAL_HOLD, {
      object: {
        rental_booking_id: bookingId,
        client_id: clientId,
        client_hold_amount: total,
        currency,
        status: 'active',
      },
    });
  }

  private async deleteBooking(id: string) {
    await this.hasuraSystemService.executeMutation(
      `mutation D($id: uuid!) { delete_rental_bookings_by_pk(id: $id) { id } }`,
      { id }
    );
  }

  private async fetchBooking(id: string) {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings_by_pk: any;
    }>(Q.GET_RENTAL_BOOKING_FULL, { id });
    return r.rental_bookings_by_pk;
  }

  private async releaseHoldIfNeeded(bookingId: string, booking: any) {
    const h = await this.getHold(bookingId);
    if (!h || h.status !== 'active') return;
    const userId = booking.client.user_id;
    const account = await this.hasuraSystemService.getAccount(
      userId,
      booking.currency
    );
    await this.accountsService.registerTransaction({
      accountId: account.id,
      amount: Number(h.client_hold_amount),
      transactionType: 'release',
      memo: `Release rental hold ${bookingId}`,
      referenceId: bookingId,
    });
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_HOLD_STATUS, {
      bookingId,
      status: 'cancelled',
    });
  }

  private async getHold(bookingId: string) {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_holds: Array<{ id: string; client_hold_amount: number; status: string }>;
    }>(
      `query H($bid: uuid!) { rental_holds(where: { rental_booking_id: { _eq: $bid } }) { id client_hold_amount status currency } }`,
      { bid: bookingId }
    );
    return r.rental_holds?.[0] ?? null;
  }

  private async settleBooking(booking: any) {
    const h = await this.getHold(booking.id);
    if (!h || h.status !== 'active') {
      throw new HttpException('Hold not active', HttpStatus.BAD_REQUEST);
    }
    const amount = Number(booking.total_amount);
    const clientUserId = booking.client.user_id;
    const clientAccount = await this.hasuraSystemService.getAccount(
      clientUserId,
      booking.currency
    );
    const locId = booking.rental_location_listing?.business_location_id;
    if (!locId) {
      throw new HttpException('Location missing', HttpStatus.BAD_REQUEST);
    }
    const businessAccount = await this.hasuraSystemService.ensureAccountForBusinessLocation(
      locId
    );
    if (!businessAccount?.id) {
      throw new HttpException('Business account missing', HttpStatus.BAD_REQUEST);
    }
    await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount: Number(h.client_hold_amount),
      transactionType: 'release',
      memo: `Release rental hold ${booking.id}`,
      referenceId: booking.id,
    });
    await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount,
      transactionType: 'payment',
      memo: `Rental payment ${booking.id}`,
      referenceId: booking.id,
    });
    await this.accountsService.registerTransaction({
      accountId: businessAccount.id,
      amount,
      transactionType: 'deposit',
      memo: `Rental proceeds ${booking.id}`,
      referenceId: booking.id,
    });
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_HOLD_STATUS, {
      bookingId: booking.id,
      status: 'completed',
    });
  }

  private async updateBookingStatus(id: string, status: string) {
    await this.hasuraSystemService.executeMutation(
      `mutation U($id: uuid!, $s: rental_booking_status_enum!) {
        update_rental_bookings_by_pk(pk_columns: { id: $id }, _set: { status: $s }) { id }
      }`,
      { id, s: status }
    );
  }

  private async patchBooking(id: string, _set: Record<string, unknown>) {
    await this.hasuraSystemService.executeMutation(
      `mutation PatchBooking($id: uuid!, $_set: rental_bookings_set_input!) {
        update_rental_bookings_by_pk(pk_columns: { id: $id }, _set: $_set) { id }
      }`,
      { id, _set }
    );
  }

  private async setBookingPinHash(id: string, hash: string) {
    await this.patchBooking(id, {
      rental_start_pin_hash: hash,
      rental_start_pin_attempts: 0,
    });
  }

  private async resetPinAttempts(id: string) {
    await this.patchBooking(id, { rental_start_pin_attempts: 0 });
  }

  private async verifyPinAttempt(bookingId: string, booking: any, pin: string) {
    const hash = booking.rental_start_pin_hash;
    if (!hash) {
      throw new HttpException('PIN not set', HttpStatus.BAD_REQUEST);
    }
    const ok = this.deliveryPinService.verifyPin(bookingId, pin, hash);
    if (ok) return;
    const fresh = await this.fetchBooking(bookingId);
    const next = (fresh?.rental_start_pin_attempts ?? 0) + 1;
    await this.hasuraSystemService.executeMutation(Q.INCREMENT_RENTAL_PIN_ATTEMPTS, {
      id: bookingId,
      attempts: next,
    });
    if (next >= this.deliveryPinService.getMaxPinAttempts()) {
      throw new HttpException('Too many attempts', HttpStatus.FORBIDDEN);
    }
    throw new HttpException('Invalid PIN', HttpStatus.FORBIDDEN);
  }

  private async verifyOverwrite(bookingId: string, booking: any, code: string) {
    const hash = booking.rental_start_overwrite_code_hash;
    if (!hash) {
      throw new HttpException('No overwrite code', HttpStatus.BAD_REQUEST);
    }
    const ok = this.deliveryPinService.verifyOverwriteCode(bookingId, code, hash);
    if (!ok) {
      throw new HttpException('Invalid overwrite code', HttpStatus.FORBIDDEN);
    }
    await this.patchBooking(bookingId, {
      rental_start_overwrite_code_used_at: new Date().toISOString(),
    });
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
