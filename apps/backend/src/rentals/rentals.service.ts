import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AccountsService } from '../accounts/accounts.service';
import { AddressesService } from '../addresses/addresses.service';
import { GoogleDistanceService } from '../google/google-distance.service';
import { MobilePaymentsDatabaseService } from '../mobile-payments/mobile-payments-database.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import { DeliveryPinService } from '../orders/delivery-pin.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBusinessRentalItemDto } from './dto/create-business-rental-item.dto';
import { CreateBusinessRentalListingDto } from './dto/create-business-rental-listing.dto';
import { UpdateBusinessRentalItemDto } from './dto/update-business-rental-item.dto';
import {
  UpdateBusinessRentalListingDto,
  UpdateRentalWeeklyAvailabilityDto,
} from './dto/update-business-rental-listing.dto';
import { CreateRentalBookingDto } from './dto/create-rental-booking.dto';
import { CreateRentalRequestDto } from './dto/create-rental-request.dto';
import { RentalWeeklyAvailabilityDto } from './dto/create-business-rental-listing.dto';
import {
  RespondRentalRequestDto,
  RespondRentalRequestStatusDto,
  UnavailableRentalReasonCode,
} from './dto/respond-rental-request.dto';
import {
  isValidRentalPricingSnapshot,
  RentalPricingLine,
  RentalPricingSnapshotDto,
} from './dto/rental-pricing-snapshot.dto';
import { VerifyRentalStartPinDto } from './dto/verify-rental-start-pin.dto';
import { InventoryItemsService } from '../inventory-items/inventory-items.service';
import * as Q from './rentals-queries';

const RENTAL_DISTANCE_CACHE_TTL = 7776000;

export type RentalListingsSort =
  | 'relevance'
  | 'newest'
  | 'fastest'
  | 'cheapest'
  | 'expensive';

export interface ListPublicRentalListingsQuery {
  country_code?: string;
  state?: string;
  sort?: string;
}

type RentalSortNormalized = RentalListingsSort;

function normalizeRentalSort(raw?: string): RentalSortNormalized {
  const allowed: RentalListingsSort[] = [
    'relevance',
    'newest',
    'fastest',
    'cheapest',
    'expensive',
  ];
  const s = (raw || 'relevance').toLowerCase();
  return allowed.includes(s as RentalListingsSort)
    ? (s as RentalListingsSort)
    : 'relevance';
}

function rentalHoursCount(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / 3600000));
}

interface WeeklyAvailabilityRow {
  weekday: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
}

type RentalRequestWindowEntry = {
  start: Date;
  end: Date;
  billing: 'hourly' | 'all_day';
  calendarDate?: string;
};

interface RentalRequestWindowPlan {
  envelopeStartIso: string;
  envelopeEndIso: string;
  selectionWindowsJson: Array<Record<string, unknown>>;
  windows: RentalRequestWindowEntry[];
  totalHours: number;
}

/** Shape of `GET_LISTING_FOR_REQUEST` row (subset used for booking-request email). */
interface RentalListingForRequestEmail {
  id: string;
  rental_item?: {
    name?: string | null;
    business?: { user_id?: string | null } | null;
  } | null;
  business_location?: { name?: string | null } | null;
}

/**
 * `GET_RENTAL_REQUEST_FULL` shape used when a business responds (available / unavailable)
 * and for client notification emails.
 */
interface RentalRequestRowForClientNotification {
  id: string;
  client_id: string;
  rental_location_listing_id: string;
  client?: { user_id?: string | null } | null;
  rental_location_listing?: {
    rental_item?: {
      name?: string | null;
      business_id?: string;
      currency?: string;
      business?: { name?: string | null } | null;
    } | null;
    base_price_per_hour?: number | string;
    base_price_per_day?: number | string;
    weekly_availability?: WeeklyAvailabilityRow[];
  } | null;
  rental_selection_windows?: unknown;
}

/** Browse catalog row: same shape as frontend `RentalListingRow`. */
export interface PublicRentalListingRow {
  id: string;
  deleted_at?: string | null;
  moderation_status?: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  min_rental_hours: number;
  max_rental_hours: number | null;
  pickup_instructions: string;
  dropoff_instructions: string;
  weekly_availability: WeeklyAvailabilityRow[];
  updated_at?: string;
  rental_item: {
    id: string;
    name: string;
    description: string;
    tags: string[];
    currency: string;
    operation_mode: string;
    deleted_at?: string | null;
    rental_category: { id: string; name: string };
    rental_item_images: Array<{ id: string; image_url: string; alt_text?: string }>;
    business: { id: string; name: string; is_verified?: boolean };
  };
  business_location: {
    id: string;
    name: string;
    address: {
      id?: string;
      address_line_1?: string;
      address_line_2?: string | null;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
      latitude?: number | null;
      longitude?: number | null;
    };
  };
  distance_text?: string;
  duration_text?: string;
  distance_value?: number;
}

/** Client “my requests” row (Hasura RLS scopes to current user). */
export interface ClientRentalRequestRow {
  id: string;
  status: string;
  rental_selection_windows?: unknown;
  created_at: string;
  business_response_note?: string | null;
  client_request_note?: string | null;
  unavailable_reason_code?: string | null;
  rental_pricing_snapshot?: unknown;
  responded_at?: string | null;
  expires_at?: string | null;
  rental_location_listing: {
    id: string;
    base_price_per_hour: number | string;
    base_price_per_day?: number | string;
    business_location?: { name: string } | null;
    rental_item: { name: string; currency: string };
  } | null;
  rental_booking?: {
    id: string;
    status: string;
    contract_expires_at?: string | null;
  } | null;
}

function rentalListingUpdatedAtMs(row: PublicRentalListingRow): number {
  return new Date(row.updated_at ?? 0).getTime();
}

function rentalPricePerHour(row: PublicRentalListingRow): number {
  const v = row.base_price_per_hour;
  return typeof v === 'number' ? v : parseFloat(String(v)) || 0;
}

function rentalPricePerDay(row: PublicRentalListingRow): number {
  const v = row.base_price_per_day;
  return typeof v === 'number' ? v : parseFloat(String(v)) || 0;
}

@Injectable()
export class RentalsService {
  private readonly logger = new Logger(RentalsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly accountsService: AccountsService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly mobilePaymentsDatabaseService: MobilePaymentsDatabaseService,
    private readonly deliveryPinService: DeliveryPinService,
    private readonly notificationsService: NotificationsService,
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly addressesService: AddressesService,
    private readonly googleDistanceService: GoogleDistanceService,
    private readonly configService: ConfigService
  ) {}

  async listPublicRentalListings(
    query: ListPublicRentalListingsQuery = {}
  ): Promise<PublicRentalListingRow[]> {
    const sort = normalizeRentalSort(query.sort);
    const geo = await this.resolveRentalCatalogGeo(query.country_code, query.state);
    if (geo.filterMode === 'specific' && (geo.country || geo.state)) {
      const ok = await this.inventoryItemsService.isCatalogLocationSupported(
        geo.country,
        geo.state
      );
      if (!ok) return [];
    }
    const baseWhere = await this.buildRentalListingWhere(
      geo.filterMode,
      geo.country,
      geo.state
    );
    const where = this.whereExcludingActiveProposedContracts(baseWhere);
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings: PublicRentalListingRow[];
    }>(Q.LIST_PUBLIC_RENTAL_LISTINGS, {
      where,
      order_by: [{ updated_at: 'desc' }],
    });
    let rows = r.rental_location_listings ?? [];
    rows = await this.enrichRentalListingsWithDistance(rows);
    return this.sortRentalListingRows(rows, sort);
  }

  async getPublicRentalListingById(
    listingId: string,
    query: ListPublicRentalListingsQuery = {}
  ): Promise<PublicRentalListingRow | null> {
    const geo = await this.resolveRentalCatalogGeo(query.country_code, query.state);
    if (geo.filterMode === 'specific' && (geo.country || geo.state)) {
      const ok = await this.inventoryItemsService.isCatalogLocationSupported(
        geo.country,
        geo.state
      );
      if (!ok) return null;
    }
    const supportedCodes =
      geo.filterMode === 'supported_only'
        ? await this.inventoryItemsService.getActiveSupportedCountryCodes()
        : [];
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings_by_pk: PublicRentalListingRow | null;
    }>(Q.GET_PUBLIC_RENTAL_LISTING_BY_PK, { id: listingId });
    const row = r.rental_location_listings_by_pk;
    if (!row) return null;
    if (row.moderation_status !== 'approved') {
      return null;
    }
    if (row.deleted_at || row.rental_item?.deleted_at) {
      return null;
    }
    if (await this.listingHasActiveProposedContract(listingId)) {
      return null;
    }
    if (
      !this.listingMatchesCatalogGeo(
        row,
        geo.filterMode,
        supportedCodes,
        geo.country,
        geo.state
      )
    ) {
      return null;
    }
    const enriched = await this.enrichRentalListingsWithDistance([row]);
    return enriched[0] ?? row;
  }

  async listTakenRentalBookingWindowsForPublicListing(
    listingId: string,
    query: ListPublicRentalListingsQuery = {}
  ): Promise<Array<{ startAt: string; endAt: string }> | null> {
    const visible = await this.getPublicRentalListingById(listingId, query);
    if (!visible) {
      return null;
    }
    const res = await this.hasuraSystemService.executeQuery<{
      rental_booking_windows: Array<{ start_at: string; end_at: string }>;
    }>(Q.LIST_TAKEN_RENTAL_BOOKING_WINDOWS, { listingId });
    return (res.rental_booking_windows ?? []).map((b) => ({
      startAt: b.start_at,
      endAt: b.end_at,
    }));
  }

  async createRentalRequest(dto: CreateRentalRequestDto) {
    const user = await this.hasuraUserService.getUser();
    if (!user.client) {
      throw new HttpException('Only clients can create requests', HttpStatus.FORBIDDEN);
    }
    const listing = await this.fetchListing(dto.rentalLocationListingId);
    this.assertListingBookable(listing);
    const plan = this.buildCreateRentalRequestPlan(dto);
    await this.validateRentalRequestWindowsPlan(plan, listing);
    const note = dto.clientRequestNote?.trim();
    const row = await this.hasuraSystemService.executeMutation<{
      insert_rental_requests_one: { id: string };
    }>(Q.INSERT_RENTAL_REQUEST, {
      object: {
        client_id: user.client.id,
        rental_location_listing_id: listing.id,
        rental_selection_windows: plan.selectionWindowsJson,
        status: 'pending',
        client_request_note: note || null,
      },
    });
    const requestId = row.insert_rental_requests_one.id;
    await this.emailBusinessNewRentalRequest(
      listing,
      requestId,
      plan.envelopeStartIso,
      plan.envelopeEndIso,
      user
    );
    return { success: true, requestId };
  }

  private async emailBusinessNewRentalRequest(
    listing: RentalListingForRequestEmail,
    requestId: string,
    requestedStartAt: string,
    requestedEndAt: string,
    user: { first_name?: string | null; last_name?: string | null }
  ) {
    const businessUserId = listing.rental_item?.business?.user_id ?? undefined;
    if (!businessUserId) return;
    const clientName =
      [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'A client';
    const locationName = listing.business_location?.name?.trim() || '—';
    await this.notificationsService.sendBusinessRentalBookingRequestEmail({
      businessUserId,
      requestId,
      listingId: listing.id,
      rentalItemName: listing.rental_item?.name ?? 'Rental',
      locationName,
      requestedStartAt,
      requestedEndAt,
      clientName,
    });
  }

  private async emailClientRentalRequestAccepted(
    req: RentalRequestRowForClientNotification,
    bookingNumber: string,
    contractExpiresAt: string,
    requestId: string
  ) {
    const clientUserId = req.client?.user_id ?? undefined;
    if (!clientUserId) return;
    const item = req.rental_location_listing?.rental_item;
    await this.notificationsService.sendClientRentalRequestAcceptedEmail({
      clientUserId,
      requestId,
      rentalItemName: item?.name ?? 'Rental',
      businessName: item?.business?.name?.trim() || '—',
      bookingNumber,
      contractExpiresAt,
      requestedStartAt: this.requestWindowEnvelope(req).startAt,
      requestedEndAt: this.requestWindowEnvelope(req).endAt,
    });
  }

  private async emailClientRentalRequestRejected(
    req: RentalRequestRowForClientNotification,
    code: string,
    note: string | null | undefined,
    requestId: string
  ) {
    const clientUserId = req.client?.user_id ?? undefined;
    if (!clientUserId) return;
    const item = req.rental_location_listing?.rental_item;
    await this.notificationsService.sendClientRentalRequestRejectedEmail({
      clientUserId,
      requestId,
      rentalItemName: item?.name ?? 'Rental',
      businessName: item?.business?.name?.trim() || '—',
      unavailableReasonCode: code,
      businessResponseNote: note,
    });
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
    const respondedAt = new Date().toISOString();
    if (dto.status === RespondRentalRequestStatusDto.available) {
      await this.respondRentalRequestAvailable(
        requestId,
        dto,
        user.id,
        req as RentalRequestRowForClientNotification,
        respondedAt
      );
    } else {
      await this.respondRentalRequestUnavailable(
        requestId,
        dto,
        user.id,
        req as RentalRequestRowForClientNotification,
        respondedAt
      );
    }
    return { success: true };
  }

  private async respondRentalRequestUnavailable(
    requestId: string,
    dto: RespondRentalRequestDto,
    userId: string,
    req: RentalRequestRowForClientNotification,
    respondedAt: string
  ) {
    if (dto.unavailableReasonCode == null) {
      throw new HttpException('unavailableReasonCode is required', HttpStatus.BAD_REQUEST);
    }
    if (dto.unavailableReasonCode === UnavailableRentalReasonCode.other) {
      const note = dto.businessResponseNote?.trim() ?? '';
      if (!note) {
        throw new HttpException(
          'businessResponseNote is required when reason is other',
          HttpStatus.BAD_REQUEST
        );
      }
    }
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_RESPOND, {
      id: requestId,
      status: dto.status,
      snapshot: null,
      note: dto.businessResponseNote?.trim() ?? null,
      unavailableReasonCode: dto.unavailableReasonCode,
      requestExpiresAt: null,
      respondedAt,
      userId,
    });
    await this.emailClientRentalRequestRejected(
      req,
      dto.unavailableReasonCode,
      dto.businessResponseNote,
      requestId
    );
  }

  private async respondRentalRequestAvailable(
    requestId: string,
    dto: RespondRentalRequestDto,
    userId: string,
    req: RentalRequestRowForClientNotification,
    respondedAt: string
  ) {
    if (dto.contractExpiryHours == null) {
      throw new HttpException('contractExpiryHours is required when available', HttpStatus.BAD_REQUEST);
    }
    const computedSnapshot = this.computePricingSnapshotForRequest(req);
    this.assertSnapshotCurrency(computedSnapshot, req);
    const hours = dto.contractExpiryHours;
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
      throw new HttpException('contractExpiryHours must be between 1 and 168', HttpStatus.BAD_REQUEST);
    }
    const listingId = req.rental_location_listing_id;
    const now = new Date();
    const nowIso = now.toISOString();
    const activeProposed = await this.countActiveProposedBookingsForListing(listingId, nowIso);
    if (activeProposed > 0) {
      throw new HttpException(
        'This listing already has an active rental contract',
        HttpStatus.CONFLICT
      );
    }
    const snap = computedSnapshot;
    const total = Number(snap.total);
    const contractExpiresAt = new Date(now.getTime() + hours * 3600000).toISOString();
    const clientId = req.client_id;
    let bookingId: string | null = null;
    try {
      const ins = await this.insertProposedBookingRow(req, clientId, snap, total, contractExpiresAt);
      bookingId = ins.insert_rental_bookings_one.id;
      await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_RESPOND, {
        id: requestId,
        status: dto.status,
        snapshot: snap,
        note: dto.businessResponseNote?.trim() ?? null,
        unavailableReasonCode: null,
        requestExpiresAt: contractExpiresAt,
        respondedAt,
        userId,
      });
      await this.emailClientRentalRequestAccepted(
        req,
        ins.insert_rental_bookings_one.booking_number,
        contractExpiresAt,
        requestId
      );
    } catch (e: any) {
      if (bookingId) await this.deleteBooking(bookingId);
      throw e instanceof HttpException
        ? e
        : new HttpException(e?.message || 'Failed to respond', HttpStatus.BAD_REQUEST);
    }
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

  async getBusinessRentalSchedule(rentalItemId: string): Promise<any[]> {
    await this.requireBusinessId();
    const r = await this.hasuraUserService.executeQuery<{
      rental_bookings: any[];
    }>(Q.GET_BUSINESS_RENTAL_SCHEDULE, { rentalItemId });
    return r.rental_bookings ?? [];
  }

  async getClientRentalRequests(): Promise<ClientRentalRequestRow[]> {
    await this.requireClientId();
    const r = await this.hasuraUserService.executeQuery<{
      rental_requests: ClientRentalRequestRow[];
    }>(Q.GET_CLIENT_RENTAL_REQUESTS, {});
    return r.rental_requests ?? [];
  }

  async cancelClientRentalRequest(requestId: string): Promise<{ success: boolean }> {
    const user = await this.hasuraUserService.getUser();
    if (!user?.client) {
      throw new HttpException('Only clients can cancel requests', HttpStatus.FORBIDDEN);
    }
    const req = await this.fetchRequest(requestId);
    if (req.client_id !== user.client.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    if (req.status === 'pending') {
      await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_STATUS, {
        id: requestId,
        status: 'cancelled',
      });
      return { success: true };
    }
    if (req.status === 'available') {
      const booking = req.rental_booking as { id?: string; status?: string } | null | undefined;
      if (booking?.id && booking.status === 'proposed') {
        await this.patchBooking(booking.id, {
          status: 'cancelled',
          contract_expires_at: null,
        });
        await this.logHistory(
          booking.id,
          'cancelled',
          'proposed',
          user.id,
          'client',
          'Client withdrew before confirming'
        );
      }
      await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_STATUS, {
        id: requestId,
        status: 'cancelled',
      });
      return { success: true };
    }
    throw new HttpException(
      'This request cannot be cancelled',
      HttpStatus.BAD_REQUEST
    );
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
    const minHours = dto.min_rental_hours ?? 1;
    const maxHours =
      dto.max_rental_hours === undefined ? null : dto.max_rental_hours;
    if (maxHours != null && maxHours < minHours) {
      throw new HttpException(
        'max_rental_hours must be >= min_rental_hours',
        HttpStatus.BAD_REQUEST
      );
    }
    const price = Number(dto.base_price_per_hour);
    if (Number.isNaN(price) || price < 0) {
      throw new HttpException('Invalid base_price_per_hour', HttpStatus.BAD_REQUEST);
    }
    const dayPrice = Number(dto.base_price_per_day);
    if (Number.isNaN(dayPrice) || dayPrice < 0) {
      throw new HttpException('Invalid base_price_per_day', HttpStatus.BAD_REQUEST);
    }
    const availability = this.normalizeWeeklyAvailability(dto.weekly_availability);
    const row = await this.hasuraUserService.executeMutation<{
      insert_rental_location_listings_one: { id: string } | null;
    }>(Q.INSERT_BUSINESS_RENTAL_LISTING, {
      object: {
        rental_item_id: dto.rental_item_id,
        business_location_id: dto.business_location_id,
        pickup_instructions: dto.pickup_instructions?.trim() ?? '',
        dropoff_instructions: dto.dropoff_instructions?.trim() ?? '',
        base_price_per_hour: price,
        base_price_per_day: dayPrice,
        min_rental_hours: minHours,
        max_rental_hours: maxHours,
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
    await this.upsertWeeklyAvailability(id, availability);
    return id;
  }

  async getBusinessRentalItemById(itemId: string): Promise<any> {
    const businessId = await this.requireBusinessId();
    await this.assertRentalItemForBusiness(itemId, businessId);
    const r = await this.hasuraUserService.executeQuery<{
      rental_items_by_pk: any | null;
    }>(Q.GET_BUSINESS_RENTAL_ITEM_DETAIL, { id: itemId });
    if (!r.rental_items_by_pk) {
      throw new HttpException('Rental item not found', HttpStatus.NOT_FOUND);
    }
    return r.rental_items_by_pk;
  }

  async updateBusinessRentalItem(
    itemId: string,
    dto: UpdateBusinessRentalItemDto
  ): Promise<void> {
    const businessId = await this.requireBusinessId();
    await this.assertRentalItemForBusiness(itemId, businessId);
    const changes = this.buildRentalItemUpdateSet(dto);
    if (!Object.keys(changes).length) {
      return;
    }
    const result = await this.hasuraUserService.executeMutation<{
      update_rental_items_by_pk: { id: string } | null;
    }>(Q.UPDATE_BUSINESS_RENTAL_ITEM, { id: itemId, _set: changes });
    if (!result.update_rental_items_by_pk) {
      throw new HttpException('Update failed', HttpStatus.BAD_REQUEST);
    }
  }

  async softDeleteBusinessRentalListing(listingId: string): Promise<void> {
    const businessId = await this.requireBusinessId();
    await this.assertRentalListingForBusiness(listingId, businessId, {
      allowDeleted: true,
    });
    if (await this.rentalListingIsAlreadySoftDeleted(listingId)) {
      return;
    }
    await this.assertNoBlockingWorkflowsForListing(listingId);
    await this.runSoftDeleteRentalListing(listingId);
  }

  async softDeleteBusinessRentalItem(itemId: string): Promise<void> {
    const businessId = await this.requireBusinessId();
    await this.assertRentalItemForBusiness(itemId, businessId, {
      allowDeleted: true,
    });
    if (await this.rentalItemIsAlreadySoftDeleted(itemId)) {
      return;
    }
    await this.assertNoBlockingWorkflowsForRentalItem(itemId);
    await this.runSoftDeleteRentalItemAndListings(itemId);
  }

  async updateBusinessRentalListing(
    listingId: string,
    dto: UpdateBusinessRentalListingDto
  ): Promise<void> {
    const businessId = await this.requireBusinessId();
    const listingRow = await this.loadRentalListingBusinessRow(
      listingId,
      businessId
    );
    const wasRejected = listingRow.moderation_status === 'rejected';
    const changes = this.buildListingUpdateSet(dto);
    if (!Object.keys(changes).length) {
      const availabilityOnly = dto.weekly_availability !== undefined;
      if (!availabilityOnly) return;
    }
    if (Object.keys(changes).length) {
      await this.assertListingMinMaxAfterPatch(listingId, changes);
      const result = await this.hasuraUserService.executeMutation<{
        update_rental_location_listings_by_pk: { id: string } | null;
      }>(Q.UPDATE_BUSINESS_RENTAL_LISTING, { id: listingId, _set: changes });
      if (!result.update_rental_location_listings_by_pk) {
        throw new HttpException('Update failed', HttpStatus.BAD_REQUEST);
      }
    }
    if (dto.weekly_availability !== undefined) {
      const availability = this.normalizeWeeklyAvailability(dto.weekly_availability);
      await this.upsertWeeklyAvailability(listingId, availability);
    }
    const resubmitted =
      wasRejected &&
      (Object.keys(changes).length > 0 || dto.weekly_availability !== undefined);
    if (resubmitted) {
      await this.resetRejectedListingToPendingModeration(listingId);
    }
  }

  private buildRentalItemUpdateSet(
    dto: UpdateBusinessRentalItemDto
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      out.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      out.description = dto.description.trim();
    }
    if (dto.rental_category_id !== undefined) {
      out.rental_category_id = dto.rental_category_id;
    }
    if (dto.tags !== undefined) {
      out.tags = dto.tags;
    }
    if (dto.currency !== undefined) {
      out.currency = dto.currency.trim();
    }
    if (dto.is_active !== undefined) {
      out.is_active = dto.is_active;
    }
    return out;
  }

  private buildListingUpdateSet(
    dto: UpdateBusinessRentalListingDto
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (dto.pickup_instructions !== undefined) {
      out.pickup_instructions = dto.pickup_instructions.trim();
    }
    if (dto.dropoff_instructions !== undefined) {
      out.dropoff_instructions = dto.dropoff_instructions.trim();
    }
    if (dto.base_price_per_hour !== undefined) {
      const p = Number(dto.base_price_per_hour);
      if (Number.isNaN(p) || p < 0) {
        throw new HttpException(
          'Invalid base_price_per_hour',
          HttpStatus.BAD_REQUEST
        );
      }
      out.base_price_per_hour = p;
    }
    if (dto.base_price_per_day !== undefined) {
      const p = Number(dto.base_price_per_day);
      if (Number.isNaN(p) || p < 0) {
        throw new HttpException(
          'Invalid base_price_per_day',
          HttpStatus.BAD_REQUEST
        );
      }
      out.base_price_per_day = p;
    }
    if (dto.min_rental_hours !== undefined) {
      out.min_rental_hours = dto.min_rental_hours;
    }
    if (dto.max_rental_hours !== undefined) {
      out.max_rental_hours = dto.max_rental_hours;
    }
    if (dto.units_available !== undefined) {
      out.units_available = dto.units_available;
    }
    if (dto.is_active !== undefined) {
      out.is_active = dto.is_active;
    }
    return out;
  }

  private async assertListingMinMaxAfterPatch(
    listingId: string,
    set: Record<string, unknown>
  ): Promise<void> {
    if (
      set.min_rental_hours === undefined &&
      set.max_rental_hours === undefined
    ) {
      return;
    }
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings_by_pk: {
        min_rental_hours: number;
        max_rental_hours: number | null;
      } | null;
    }>(Q.GET_RENTAL_LISTING_MIN_MAX, { id: listingId });
    const cur = r.rental_location_listings_by_pk;
    if (!cur) {
      return;
    }
    const min =
      (set.min_rental_hours as number) ?? cur.min_rental_hours;
    const max =
      set.max_rental_hours === undefined
        ? cur.max_rental_hours
        : (set.max_rental_hours as number | null);
    if (max != null && max < min) {
      throw new HttpException(
        'max_rental_hours must be >= min_rental_hours',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async loadRentalListingBusinessRow(
    listingId: string,
    businessId: string,
    options: { allowDeleted?: boolean } = {}
  ): Promise<{
    deleted_at: string | null;
    moderation_status: string;
    rental_item: { business_id: string; deleted_at: string | null };
  }> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings_by_pk: {
        deleted_at: string | null;
        moderation_status: string;
        rental_item: { business_id: string; deleted_at: string | null };
      } | null;
    }>(Q.GET_RENTAL_LISTING_BUSINESS_CHECK, { id: listingId });
    const row = r.rental_location_listings_by_pk;
    if (!row || row.rental_item.business_id !== businessId) {
      throw new HttpException('Listing not found', HttpStatus.NOT_FOUND);
    }
    if (
      !options.allowDeleted &&
      (row.deleted_at || row.rental_item.deleted_at)
    ) {
      throw new HttpException('This listing was removed', HttpStatus.BAD_REQUEST);
    }
    return row;
  }

  private async assertRentalListingForBusiness(
    listingId: string,
    businessId: string,
    options: { allowDeleted?: boolean } = {}
  ): Promise<void> {
    await this.loadRentalListingBusinessRow(listingId, businessId, options);
  }

  private async resetRejectedListingToPendingModeration(
    listingId: string
  ): Promise<void> {
    const result = await this.hasuraSystemService.executeMutation<{
      update_rental_location_listings_by_pk: { id: string } | null;
    }>(Q.RESET_RENTAL_LISTING_MODERATION_PENDING, { id: listingId });
    if (!result.update_rental_location_listings_by_pk) {
      throw new HttpException(
        'Failed to resubmit listing for review',
        HttpStatus.BAD_REQUEST
      );
    }
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

  private async requireClientId(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    const id = user?.client?.id;
    if (!id) {
      throw new HttpException(
        { success: false, error: 'Client profile required' },
        HttpStatus.FORBIDDEN
      );
    }
    return id;
  }

  private async assertRentalItemForBusiness(
    itemId: string,
    businessId: string,
    options: { allowDeleted?: boolean } = {}
  ): Promise<void> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_items_by_pk: {
        business_id: string;
        deleted_at: string | null;
      } | null;
    }>(Q.GET_RENTAL_ITEM_BUSINESS_CHECK, { id: itemId });
    const row = r.rental_items_by_pk;
    if (!row || row.business_id !== businessId) {
      throw new HttpException('Rental item not found', HttpStatus.NOT_FOUND);
    }
    if (!options.allowDeleted && row.deleted_at) {
      throw new HttpException(
        'This rental item was removed',
        HttpStatus.BAD_REQUEST
      );
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

  private async rentalListingIsAlreadySoftDeleted(
    listingId: string
  ): Promise<boolean> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings_by_pk: { deleted_at: string | null } | null;
    }>(Q.GET_RENTAL_LISTING_BUSINESS_CHECK, { id: listingId });
    return !!r.rental_location_listings_by_pk?.deleted_at;
  }

  private async rentalItemIsAlreadySoftDeleted(itemId: string): Promise<boolean> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_items_by_pk: { deleted_at: string | null } | null;
    }>(Q.GET_RENTAL_ITEM_BUSINESS_CHECK, { id: itemId });
    return !!r.rental_items_by_pk?.deleted_at;
  }

  private async assertNoBlockingWorkflowsForListing(
    listingId: string
  ): Promise<void> {
    const bookings = await this.countInFlightBookingsForListing(listingId);
    if (bookings > 0) {
      throw new HttpException(
        'Cannot remove this listing while there are active bookings.',
        HttpStatus.CONFLICT
      );
    }
    const requests = await this.countOpenRequestsForListing(listingId);
    if (requests > 0) {
      throw new HttpException(
        'Cannot remove this listing while there are open rental requests.',
        HttpStatus.CONFLICT
      );
    }
  }

  private async assertNoBlockingWorkflowsForRentalItem(
    itemId: string
  ): Promise<void> {
    const bookings = await this.countInFlightBookingsForRentalItem(itemId);
    if (bookings > 0) {
      throw new HttpException(
        'Cannot remove this rental item while there are active bookings.',
        HttpStatus.CONFLICT
      );
    }
    const requests = await this.countOpenRequestsForRentalItem(itemId);
    if (requests > 0) {
      throw new HttpException(
        'Cannot remove this rental item while there are open rental requests.',
        HttpStatus.CONFLICT
      );
    }
  }

  private async runSoftDeleteRentalListing(listingId: string): Promise<void> {
    const deletedAt = new Date().toISOString();
    await this.hasuraUserService.executeMutation(Q.SOFT_DELETE_RENTAL_LOCATION_LISTING, {
      id: listingId,
      deletedAt,
    });
  }

  private async runSoftDeleteRentalItemAndListings(itemId: string): Promise<void> {
    const deletedAt = new Date().toISOString();
    await this.hasuraUserService.executeMutation(Q.SOFT_DELETE_RENTAL_LISTINGS_FOR_ITEM, {
      rentalItemId: itemId,
      deletedAt,
    });
    await this.hasuraUserService.executeMutation(Q.SOFT_DELETE_RENTAL_ITEM, {
      id: itemId,
      deletedAt,
    });
  }

  private async countInFlightBookingsForListing(listingId: string): Promise<number> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings_aggregate: { aggregate: { count: number } | null } | null;
    }>(Q.COUNT_IN_FLIGHT_RENTAL_BOOKINGS_FOR_LISTING, { listingId });
    return r.rental_bookings_aggregate?.aggregate?.count ?? 0;
  }

  private async countOpenRequestsForListing(listingId: string): Promise<number> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_requests_aggregate: { aggregate: { count: number } | null } | null;
    }>(Q.COUNT_OPEN_RENTAL_REQUESTS_FOR_LISTING, { listingId });
    return r.rental_requests_aggregate?.aggregate?.count ?? 0;
  }

  private async countInFlightBookingsForRentalItem(itemId: string): Promise<number> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings_aggregate: { aggregate: { count: number } | null } | null;
    }>(Q.COUNT_IN_FLIGHT_RENTAL_BOOKINGS_FOR_RENTAL_ITEM, { rentalItemId: itemId });
    return r.rental_bookings_aggregate?.aggregate?.count ?? 0;
  }

  private async countOpenRequestsForRentalItem(itemId: string): Promise<number> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_requests_aggregate: { aggregate: { count: number } | null } | null;
    }>(Q.COUNT_OPEN_RENTAL_REQUESTS_FOR_RENTAL_ITEM, { rentalItemId: itemId });
    return r.rental_requests_aggregate?.aggregate?.count ?? 0;
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
    const rowBooking = await this.fetchBookingSummaryByRentalRequestId(dto.rentalRequestId);
    const nested = req.rental_booking as
      | { id?: string; booking_number?: string; status?: string; contract_expires_at?: string | null }
      | null
      | undefined;
    const existing = rowBooking ?? nested;
    const clientId = user.client.id;
    const userId = user.id;
    if (existing?.status === 'proposed' && existing.id) {
      req.rental_booking = {
        id: existing.id,
        booking_number: existing.booking_number,
        status: existing.status,
        contract_expires_at: existing.contract_expires_at ?? null,
      };
      return this.confirmProposedRentalBooking(
        dto.rentalRequestId,
        req,
        userId,
        clientId,
        user.phone_number || '',
        user.email
      );
    }
    if (existing?.id) {
      throw new HttpException(
        'A booking already exists for this request',
        HttpStatus.CONFLICT
      );
    }
    return this.createLegacyRentalBooking(
      dto.rentalRequestId,
      req,
      userId,
      clientId,
      user.phone_number || '',
      user.email
    );
  }

  async expireProposedRentalContracts(): Promise<number> {
    const now = new Date().toISOString();
    const res = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{ id: string; rental_request_id: string }>;
    }>(Q.LIST_EXPIRED_PROPOSED_RENTAL_BOOKINGS, { now });
    const rows = res.rental_bookings ?? [];
    for (const b of rows) {
      try {
        await this.patchBooking(b.id, {
          status: 'cancelled',
          contract_expires_at: null,
        });
        await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_STATUS, {
          id: b.rental_request_id,
          status: 'expired',
        });
        await this.logHistory(
          b.id,
          'cancelled',
          'proposed',
          null,
          'system',
          'Rental contract expired'
        );
      } catch (error: any) {
        this.logger.error(`expireProposedRentalContracts ${b.id}: ${error.message}`);
      }
    }
    return rows.length;
  }

  private async confirmProposedRentalBooking(
    requestId: string,
    req: any,
    userId: string,
    clientId: string,
    phoneNumber: string,
    email: string
  ) {
    const bookingId = req.rental_booking?.id as string;
    const bookingNumber = req.rental_booking?.booking_number as string | undefined;
    const exp = req.rental_booking?.contract_expires_at as string | null | undefined;
    if (!exp || new Date(exp) <= new Date()) {
      throw new HttpException('Contract has expired', HttpStatus.GONE);
    }
    await this.assertCapacityForRequestWindows(
      req.rental_location_listing_id,
      req.rental_location_listing.units_available,
      req
    );
    const snap = req.rental_pricing_snapshot as RentalPricingSnapshotDto;
    const total = Number(snap.total);

    const clientAccount = await this.hasuraSystemService.getAccount(userId, snap.currency);
    const availableBalance = Number(clientAccount?.available_balance ?? 0);

    if (availableBalance >= total) {
      await this.placeHoldForBooking(bookingId, clientId, total, snap.currency);
      await this.finalizeRentalBookingConfirmation(bookingId, requestId, userId);
      return { success: true, bookingId };
    }

    if (!bookingNumber) {
      throw new HttpException('Missing booking_number for this rental booking', HttpStatus.BAD_REQUEST);
    }

    const hasPending = await this.mobilePaymentsDatabaseService.hasPendingRentalBookingPayment(bookingNumber);
    if (hasPending) {
      return { success: true, bookingId };
    }

    const paymentReference = this.createRentalPaymentReference();
    await this.initiateRentalBookingPayment({
      bookingNumber,
      amount: total,
      currency: snap.currency,
      clientAccountId: clientAccount.id,
      userId,
      phoneNumber,
      email,
      reference: paymentReference,
      paymentEntity: 'rental_booking',
    });

    // Keep booking in `proposed` until the payment callback confirms it.
    return { success: true, bookingId };
  }

  private async createLegacyRentalBooking(
    requestId: string,
    req: any,
    userId: string,
    clientId: string,
    phoneNumber: string,
    email: string
  ) {
    await this.assertCapacityForRequestWindows(
      req.rental_location_listing_id,
      req.rental_location_listing.units_available,
      req
    );
    const snap = req.rental_pricing_snapshot as RentalPricingSnapshotDto;
    const total = Number(snap.total);
    const clientAccount = await this.hasuraSystemService.getAccount(userId, snap.currency);
    const availableBalance = Number(clientAccount?.available_balance ?? 0);

    // Wallet path: insert a confirmed booking immediately.
    if (availableBalance >= total) {
      const bookingRow = await this.insertBookingRow(req, clientId, snap, total);
      const bookingId = bookingRow.insert_rental_bookings_one.id;
      try {
        await this.placeHoldForBooking(bookingId, clientId, total, snap.currency);
      } catch (e: any) {
        await this.deleteBooking(bookingId);
        throw new HttpException(e.message || 'Hold failed', HttpStatus.BAD_REQUEST);
      }

      await this.finalizeRentalBookingConfirmation(
        bookingId,
        requestId,
        userId,
        null,
        'Booking created'
      );
      return { success: true, bookingId };
    }

    // Payment path: insert a proposed booking and initiate mobile payment.
    const contractExpiresAt = req.expires_at as string | null | undefined;
    if (!contractExpiresAt) {
      throw new HttpException('Missing contract_expires_at', HttpStatus.BAD_REQUEST);
    }

    const bookingRow = await this.insertProposedBookingRow(
      req,
      clientId,
      snap,
      total,
      contractExpiresAt
    );
    const bookingId = bookingRow.insert_rental_bookings_one.id;
    const bookingNumber = bookingRow.insert_rental_bookings_one.booking_number;

    const hasPending = await this.mobilePaymentsDatabaseService.hasPendingRentalBookingPayment(bookingNumber);
    if (!hasPending) {
      try {
        const paymentReference = this.createRentalPaymentReference();
        await this.initiateRentalBookingPayment({
          bookingNumber,
          amount: total,
          currency: snap.currency,
          clientAccountId: clientAccount.id,
          userId,
          phoneNumber,
          email,
          reference: paymentReference,
          paymentEntity: 'rental_booking',
        });
      } catch (e: any) {
        await this.deleteBooking(bookingId);
        throw e;
      }
    }

    // Keep booking in `proposed` until payment callback confirms it.
    return { success: true, bookingId };
  }

  private async finalizeRentalBookingConfirmation(
    bookingId: string,
    requestId: string,
    clientUserId: string,
    previousStatus: string | null = 'proposed',
    notes = 'Booking confirmed'
  ): Promise<void> {
    await this.patchBooking(bookingId, {
      status: 'confirmed',
      contract_expires_at: null,
    });
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_STATUS, {
      id: requestId,
      status: 'booked',
    });
    const pin = this.deliveryPinService.generatePin();
    const hash = this.deliveryPinService.hashPin(bookingId, pin);
    await this.setBookingPinHash(bookingId, hash);
    this.deliveryPinService.setPinForClient(bookingId, pin);
    await this.logHistory(bookingId, 'confirmed', previousStatus, clientUserId, 'client', notes);
  }

  private async initiateRentalBookingPayment(params: {
    bookingNumber: string;
    amount: number;
    currency: string;
    clientAccountId: string;
    userId: string;
    phoneNumber: string;
    email: string;
    reference: string;
    paymentEntity: 'rental_booking';
  }): Promise<void> {
    if (!params.phoneNumber.trim()) {
      throw new HttpException(
        'Phone number is required for payment',
        HttpStatus.BAD_REQUEST
      );
    }

    const provider = this.mobilePaymentsService.getProvider(params.phoneNumber);

    const isMyPVitLike =
      provider === 'mypvit' || provider === 'airtel' || provider === 'moov';

    // MyPVit-style providers validate:
    // - `reference` must be alphanumeric
    // - `free_info` (mapped from our `description`) must be <= 15 chars
    const providerReference = isMyPVitLike
      ? params.reference.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)
      : params.reference;

    const descriptionShort = isMyPVitLike
      ? providerReference
      : `rental booking ${params.bookingNumber}`;

    const transaction = await this.mobilePaymentsDatabaseService.createTransaction({
      reference: providerReference,
      amount: params.amount,
      currency: params.currency,
      description: descriptionShort,
      provider,
      payment_method: 'mobile_money',
      customer_phone: params.phoneNumber,
      customer_email: params.email,
      account_id: params.clientAccountId,
      transaction_type: 'PAYMENT',
      payment_entity: params.paymentEntity,
      entity_id: params.bookingNumber,
    });

    const paymentRequest = {
      amount: params.amount,
      currency: params.currency,
      description: descriptionShort,
      customerPhone: params.phoneNumber,
      provider,
      ownerCharge: 'CUSTOMER' as const,
      transactionType: 'PAYMENT' as const,
      payment_entity: params.paymentEntity,
    };

    const paymentResponse = await this.mobilePaymentsService.initiatePayment(
      paymentRequest,
      providerReference,
      params.userId
    );

    if (!paymentResponse.success) {
      await this.mobilePaymentsDatabaseService.updateTransaction(transaction.id, {
        status: 'failed',
        error_message: paymentResponse.message,
        error_code: paymentResponse.errorCode,
      });

      throw new HttpException(
        {
          success: false,
          message: paymentResponse.message || 'Failed to initiate payment',
          error: paymentResponse.errorCode || 'PAYMENT_INITIATION_FAILED',
          data: {
            bookingNumber: params.bookingNumber,
            errorCode: paymentResponse.errorCode,
          },
        },
        HttpStatus.BAD_REQUEST
      );
    }

    if (paymentResponse.transactionId) {
      await this.mobilePaymentsDatabaseService.updateTransaction(transaction.id, {
        transaction_id: paymentResponse.transactionId,
      });
    }
  }

  private async fetchBookingByBookingNumber(bookingNumber: string): Promise<any | null> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings: any[];
    }>(Q.GET_RENTAL_BOOKING_FULL_BY_BOOKING_NUMBER, { bookingNumber });

    return r.rental_bookings?.[0] ?? null;
  }

  /**
   * Called from mobile payment webhooks after the client account is credited.
   * It confirms the existing `rental_bookings` proposed row, places a hold,
   * and generates the client PIN.
   */
  async processRentalBookingPayment(transaction: any): Promise<void> {
    const bookingNumber = transaction?.entity_id || transaction?.reference;
    if (!bookingNumber) {
      this.logger.warn('processRentalBookingPayment: missing bookingNumber');
      return;
    }

    const booking = await this.fetchBookingByBookingNumber(bookingNumber);
    if (!booking) {
      this.logger.warn(
        `processRentalBookingPayment: booking not found (${bookingNumber})`
      );
      return;
    }

    if (booking.status !== 'proposed') {
      // Idempotency: already confirmed/cancelled.
      return;
    }

    const hold = await this.getHold(booking.id);
    if (!hold || hold.status !== 'active') {
      await this.placeHoldForBooking(
        booking.id,
        booking.client_id,
        Number(booking.total_amount),
        booking.currency
      );
    }

    const clientUserId = booking.client?.user_id as string | undefined;
    if (!clientUserId) {
      this.logger.warn(
        `processRentalBookingPayment: missing booking client user_id for ${bookingNumber}`
      );
      return;
    }

    await this.finalizeRentalBookingConfirmation(
      booking.id,
      booking.rental_request_id,
      clientUserId
    );
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

  async getBookingDetailForViewer(bookingId: string) {
    const r = await this.hasuraUserService.executeQuery<{
      rental_bookings_by_pk: any | null;
    }>(Q.GET_RENTAL_BOOKING_DETAIL_FOR_VIEWER, { id: bookingId });
    const booking = r.rental_bookings_by_pk;
    if (!booking) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }
    return booking;
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
    if (listing.deleted_at || listing.rental_item?.deleted_at) {
      throw new HttpException('Listing not available', HttpStatus.BAD_REQUEST);
    }
    if (listing.moderation_status !== 'approved') {
      throw new HttpException('Listing not available', HttpStatus.BAD_REQUEST);
    }
    if (!listing.rental_item?.business?.is_verified) {
      throw new HttpException('Business not verified', HttpStatus.BAD_REQUEST);
    }
  }

  private assertDurationHours(listing: any, hours: number) {
    if (hours < listing.min_rental_hours) {
      throw new HttpException('Below minimum rental hours', HttpStatus.BAD_REQUEST);
    }
    if (listing.max_rental_hours != null && hours > listing.max_rental_hours) {
      throw new HttpException('Above maximum rental hours', HttpStatus.BAD_REQUEST);
    }
  }

  private assertRentalRequestStartsInFuture(start: Date) {
    if (start.getTime() <= Date.now()) {
      throw new HttpException('Start must be in the future', HttpStatus.BAD_REQUEST);
    }
  }

  private assertSnapshotCurrency(snap: RentalPricingSnapshotDto, req: any) {
    const itemCurrency = req.rental_location_listing.rental_item.currency;
    if (snap.currency !== itemCurrency) {
      throw new HttpException('Snapshot currency must match listing currency', HttpStatus.BAD_REQUEST);
    }
  }

  private buildCreateRentalRequestPlan(dto: CreateRentalRequestDto): RentalRequestWindowPlan {
    if (!dto.windows?.length && (!dto.requestedStartAt || !dto.requestedEndAt)) {
      throw new HttpException(
        'requestedStartAt and requestedEndAt are required when windows are omitted',
        HttpStatus.BAD_REQUEST
      );
    }
    const windows = this.dtoToRequestDateWindows(dto);
    this.assertValidRequestDateWindows(windows);
    return this.planFromDateWindows(windows);
  }

  private dtoToRequestDateWindows(dto: CreateRentalRequestDto): RentalRequestWindowEntry[] {
    if (dto.windows?.length) {
      return dto.windows.map((w) => {
        const billing = w.billing === 'all_day' ? 'all_day' : 'hourly';
        if (billing === 'all_day' && !w.calendarDate) {
          throw new HttpException(
            'calendarDate is required for all_day windows',
            HttpStatus.BAD_REQUEST
          );
        }
        return {
          start: new Date(w.requestedStartAt),
          end: new Date(w.requestedEndAt),
          billing,
          calendarDate: w.calendarDate,
        };
      });
    }
    return [
      {
        start: new Date(dto.requestedStartAt!),
        end: new Date(dto.requestedEndAt!),
        billing: 'hourly',
      },
    ];
  }

  private assertValidRequestDateWindows(windows: RentalRequestWindowEntry[]) {
    for (const w of windows) {
      if (Number.isNaN(w.start.getTime()) || Number.isNaN(w.end.getTime()) || !(w.end > w.start)) {
        throw new HttpException('Each window must have a valid end after start', HttpStatus.BAD_REQUEST);
      }
    }
  }

  private planFromDateWindows(windows: RentalRequestWindowEntry[]): RentalRequestWindowPlan {
    const starts = windows.map((w) => w.start.getTime());
    const ends = windows.map((w) => w.end.getTime());
    let totalHours = 0;
    for (const w of windows) {
      totalHours += rentalHoursCount(w.start, w.end);
    }
    const selectionWindowsJson = windows.map((w) => {
      const row: Record<string, unknown> = {
        start_at: w.start.toISOString(),
        end_at: w.end.toISOString(),
      };
      if (w.billing === 'all_day' && w.calendarDate) {
        row.billing = 'all_day';
        row.calendar_date = w.calendarDate;
      }
      return row;
    });
    return {
      envelopeStartIso: new Date(Math.min(...starts)).toISOString(),
      envelopeEndIso: new Date(Math.max(...ends)).toISOString(),
      selectionWindowsJson,
      windows,
      totalHours,
    };
  }

  private async validateRentalRequestWindowsPlan(
    plan: RentalRequestWindowPlan,
    listing: any
  ): Promise<void> {
    const earliest = new Date(
      Math.min(...plan.windows.map((w) => w.start.getTime()))
    );
    this.assertRentalRequestStartsInFuture(earliest);
    this.assertDurationHours(listing, plan.totalHours);
    const weekly = listing.weekly_availability ?? [];
    for (const w of plan.windows) {
      this.assertRequestedWindowInAvailability(w.start, w.end, weekly);
    }
    for (const w of plan.windows) {
      if (w.billing === 'all_day' && w.calendarDate) {
        const { start, end } = this.utcDayBoundsFromCalendarDate(w.calendarDate);
        await this.assertCapacity(listing.id, start, end, listing.units_available);
      } else {
        await this.assertCapacity(listing.id, w.start, w.end, listing.units_available);
      }
    }
  }

  private utcDayBoundsFromCalendarDate(calendarDate: string): { start: Date; end: Date } {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(calendarDate);
    if (!m) {
      throw new HttpException('Invalid calendar_date', HttpStatus.BAD_REQUEST);
    }
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const start = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private parseRentalSelectionWindows(req: any): RentalRequestWindowEntry[] {
    const raw = req.rental_selection_windows;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((w: Record<string, unknown>) => {
        const billing = w.billing === 'all_day' ? 'all_day' : 'hourly';
        const calendarDate =
          typeof w.calendar_date === 'string' ? w.calendar_date : undefined;
        return {
          start: new Date(String(w.start_at)),
          end: new Date(String(w.end_at)),
          billing,
          calendarDate,
        };
      });
    }
    throw new HttpException('rental_selection_windows is required', HttpStatus.BAD_REQUEST);
  }

  private requestWindowEnvelope(req: any): { startAt: string; endAt: string } {
    const windows = this.parseRentalSelectionWindows(req);
    const starts = windows.map((w) => w.start.getTime());
    const ends = windows.map((w) => w.end.getTime());
    return {
      startAt: new Date(Math.min(...starts)).toISOString(),
      endAt: new Date(Math.max(...ends)).toISOString(),
    };
  }

  private async assertCapacityForRequestWindows(
    listingId: string,
    units: number,
    req: any
  ): Promise<void> {
    for (const w of this.parseRentalSelectionWindows(req)) {
      if (w.billing === 'all_day' && w.calendarDate) {
        const { start, end } = this.utcDayBoundsFromCalendarDate(w.calendarDate);
        await this.assertCapacity(listingId, start, end, units);
      } else {
        await this.assertCapacity(listingId, w.start, w.end, units);
      }
    }
  }

  private normalizeWeeklyAvailability(
    rows?: RentalWeeklyAvailabilityDto[] | UpdateRentalWeeklyAvailabilityDto[]
  ): WeeklyAvailabilityRow[] {
    const defaults: WeeklyAvailabilityRow[] = [
      { weekday: 0, is_available: false, start_time: null, end_time: null },
      { weekday: 1, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
      { weekday: 2, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
      { weekday: 3, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
      { weekday: 4, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
      { weekday: 5, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
      { weekday: 6, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
    ];
    if (!rows?.length) return defaults;
    const byDay = new Map<number, WeeklyAvailabilityRow>();
    for (const row of rows) {
      const weekday = Number(row.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        throw new HttpException('weekday must be between 0 and 6', HttpStatus.BAD_REQUEST);
      }
      const normalized: WeeklyAvailabilityRow = {
        weekday,
        is_available: !!row.is_available,
        start_time: row.is_available ? (row.start_time ?? null) : null,
        end_time: row.is_available ? (row.end_time ?? null) : null,
      };
      if (normalized.is_available && (!normalized.start_time || !normalized.end_time)) {
        throw new HttpException(
          'start_time and end_time are required for available weekdays',
          HttpStatus.BAD_REQUEST
        );
      }
      if (
        normalized.is_available &&
        normalized.start_time &&
        normalized.end_time &&
        normalized.end_time <= normalized.start_time
      ) {
        throw new HttpException('end_time must be greater than start_time', HttpStatus.BAD_REQUEST);
      }
      byDay.set(weekday, normalized);
    }
    return defaults.map((d) => byDay.get(d.weekday) ?? d);
  }

  private async upsertWeeklyAvailability(listingId: string, rows: WeeklyAvailabilityRow[]) {
    await this.hasuraSystemService.executeMutation(Q.UPSERT_RENTAL_LISTING_WEEKLY_AVAILABILITY, {
      objects: rows.map((row) => ({
        listing_id: listingId,
        weekday: row.weekday,
        is_available: row.is_available,
        start_time: row.is_available ? row.start_time : null,
        end_time: row.is_available ? row.end_time : null,
      })),
    });
  }

  private assertRequestedWindowInAvailability(
    start: Date,
    end: Date,
    weekly: WeeklyAvailabilityRow[]
  ): void {
    const availabilityByDay = new Map<number, WeeklyAvailabilityRow>();
    for (const row of weekly ?? []) availabilityByDay.set(row.weekday, row);
    let cursor = new Date(start.getTime());
    while (cursor < end) {
      const day = cursor.getUTCDay();
      const row = availabilityByDay.get(day);
      if (!row?.is_available || !row.start_time || !row.end_time) {
        throw new HttpException('Requested time is outside listing availability', HttpStatus.BAD_REQUEST);
      }
      const dayStart = new Date(cursor);
      dayStart.setUTCHours(0, 0, 0, 0);
      const [sh, sm] = row.start_time.split(':').map(Number);
      const [eh, em] = row.end_time.split(':').map(Number);
      const windowStart = new Date(dayStart);
      windowStart.setUTCHours(sh, sm || 0, 0, 0);
      const windowEnd = new Date(dayStart);
      windowEnd.setUTCHours(eh, em || 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const sliceStart = cursor;
      const until = end < dayEnd ? end : dayEnd;
      if (sliceStart < windowStart || until > windowEnd) {
        throw new HttpException('Requested time is outside listing availability', HttpStatus.BAD_REQUEST);
      }
      cursor = dayEnd;
    }
  }

  private computePricingSnapshotForRequest(req: any): RentalPricingSnapshotDto {
    const parts = this.parseRentalSelectionWindows(req);
    const listing = req.rental_location_listing;
    const ratePerHour = Number(listing.base_price_per_hour);
    const ratePerDay = Number(listing.base_price_per_day);
    const lines: RentalPricingLine[] = [];
    let total = 0;
    for (const p of parts) {
      if (p.billing === 'all_day') {
        if (!p.calendarDate) {
          throw new HttpException(
            'all_day window missing calendar_date',
            HttpStatus.BAD_REQUEST
          );
        }
        const subtotal = Number(ratePerDay.toFixed(2));
        total += subtotal;
        lines.push({
          kind: 'all_day',
          calendarDate: p.calendarDate,
          ratePerDay,
          subtotal,
        });
      } else {
        const h = rentalHoursCount(p.start, p.end);
        const subtotal = Number((h * ratePerHour).toFixed(2));
        total += subtotal;
        lines.push({
          kind: 'hourly',
          startAt: p.start.toISOString(),
          endAt: p.end.toISOString(),
          billableHours: h,
          ratePerHour,
          subtotal,
        });
      }
    }
    return {
      version: 3,
      currency: listing.rental_item.currency,
      total: Number(total.toFixed(2)),
      lines,
      computedAt: new Date().toISOString(),
    };
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

  private async fetchBookingSummaryByRentalRequestId(rentalRequestId: string): Promise<{
    id: string;
    booking_number?: string | null;
    status: string;
    contract_expires_at?: string | null;
  } | null> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{
        id: string;
        booking_number?: string | null;
        status: string;
        contract_expires_at?: string | null;
      }>;
    }>(Q.GET_RENTAL_BOOKING_BY_RENTAL_REQUEST_ID, { rid: rentalRequestId });
    return r.rental_bookings?.[0] ?? null;
  }

  /**
   * Creates a human-readable rental booking number for client display and
   * for routing mobile payment callbacks (see `mobile_payment_transactions.entity_id`).
   */
  private createRentalBookingNumber(): string {
    return `RB-${Math.floor(10000000 + Math.random() * 90000000).toString()}`;
  }

  /**
   * Provider reference used for mobile-money initiation/callback lookups.
   * MyPVit requires alphanumeric and a max `free_info` length (handled via description).
   * This mirrors the reference style used for orders.
   */
  private createRentalPaymentReference(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4);
    return `R${timestamp}${random}`;
  }

  private bookingWindowsNestedInput(req: any) {
    return {
      data: this.parseRentalSelectionWindows(req).map(({ start, end }) => ({
        start_at: start.toISOString(),
        end_at: end.toISOString(),
      })),
    };
  }

  private async insertBookingRow(
    req: any,
    clientId: string,
    snap: RentalPricingSnapshotDto,
    total: number
  ) {
    return this.hasuraSystemService.executeMutation<{
      insert_rental_bookings_one: { id: string; booking_number: string };
    }>(Q.INSERT_RENTAL_BOOKING, {
      object: {
        rental_request_id: req.id,
        client_id: clientId,
        business_id: req.rental_location_listing.rental_item.business_id,
        rental_location_listing_id: req.rental_location_listing_id,
        start_at: this.requestWindowEnvelope(req).startAt,
        end_at: this.requestWindowEnvelope(req).endAt,
        total_amount: total,
        currency: snap.currency,
        rental_pricing_snapshot: snap,
        booking_number: this.createRentalBookingNumber(),
        status: 'confirmed',
        rental_booking_windows: this.bookingWindowsNestedInput(req),
      },
    });
  }

  private async insertProposedBookingRow(
    req: any,
    clientId: string,
    snap: RentalPricingSnapshotDto,
    total: number,
    contractExpiresAt: string
  ) {
    const envelope = this.requestWindowEnvelope(req);
    return this.hasuraSystemService.executeMutation<{
      insert_rental_bookings_one: { id: string; booking_number: string };
    }>(Q.INSERT_RENTAL_BOOKING, {
      object: {
        rental_request_id: req.id,
        client_id: clientId,
        business_id: req.rental_location_listing.rental_item.business_id,
        rental_location_listing_id: req.rental_location_listing_id,
        start_at: envelope.startAt,
        end_at: envelope.endAt,
        total_amount: total,
        currency: snap.currency,
        rental_pricing_snapshot: snap,
        booking_number: this.createRentalBookingNumber(),
        status: 'proposed',
        contract_expires_at: contractExpiresAt,
        rental_booking_windows: this.bookingWindowsNestedInput(req),
      },
    });
  }

  private async countActiveProposedBookingsForListing(
    listingId: string,
    nowIso: string
  ): Promise<number> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings_aggregate: { aggregate: { count: number } };
    }>(Q.COUNT_ACTIVE_PROPOSED_BOOKINGS_FOR_LISTING, { listingId, now: nowIso });
    return r.rental_bookings_aggregate?.aggregate?.count ?? 0;
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

  private async resolveRentalCatalogGeo(
    queryCountry?: string,
    queryState?: string
  ): Promise<{
    country?: string;
    state?: string;
    filterMode: 'specific' | 'supported_only';
  }> {
    let country = queryCountry?.trim() || undefined;
    let state = queryState?.trim() || undefined;
    try {
      const user = await this.hasuraUserService.getUser();
      const addresses = user?.addresses;
      if (addresses?.length) {
        const primary =
          addresses.find((a) => a.is_primary === true) ?? addresses[0];
        if (primary?.country) {
          country = primary.country;
          state = primary.state ?? state;
        }
      }
    } catch {
      // anonymous or invalid token
    }
    const filterMode = country || state ? 'specific' : 'supported_only';
    return { country, state, filterMode };
  }

  private async buildRentalListingWhere(
    filterMode: 'specific' | 'supported_only',
    country?: string,
    state?: string
  ): Promise<Record<string, unknown>> {
    if (filterMode === 'specific') {
      const parts: Record<string, unknown>[] = [];
      if (country) {
        parts.push({
          business_location: { address: { country: { _eq: country } } },
        });
      }
      if (state) {
        parts.push({
          business_location: { address: { state: { _eq: state } } },
        });
      }
      return parts.length === 1 ? parts[0]! : { _and: parts };
    }
    const codes = await this.inventoryItemsService.getActiveSupportedCountryCodes();
    if (!codes.length) {
      return { id: { _eq: '00000000-0000-0000-0000-000000000000' } };
    }
    return {
      business_location: { address: { country: { _in: codes } } },
    };
  }

  private whereExcludingActiveProposedContracts(
    base: Record<string, unknown>
  ): Record<string, unknown> {
    const nowIso = new Date().toISOString();
    return {
      _and: [
        base,
        { moderation_status: { _eq: 'approved' } },
        { deleted_at: { _is_null: true } },
        { rental_item: { deleted_at: { _is_null: true } } },
        {
          _not: {
            rental_bookings: {
              _and: [
                { status: { _eq: 'proposed' } },
                { contract_expires_at: { _gt: nowIso } },
              ],
            },
          },
        },
      ],
    };
  }

  private async listingHasActiveProposedContract(listingId: string): Promise<boolean> {
    const n = await this.countActiveProposedBookingsForListing(
      listingId,
      new Date().toISOString()
    );
    return n > 0;
  }

  private listingMatchesCatalogGeo(
    row: PublicRentalListingRow,
    filterMode: 'specific' | 'supported_only',
    supportedCodes: string[],
    country?: string,
    state?: string
  ): boolean {
    const addr = row.business_location?.address;
    const c = addr?.country?.trim();
    const s = addr?.state?.trim();
    if (filterMode === 'supported_only') {
      return !!(c && supportedCodes.includes(c));
    }
    if (country && c !== country) return false;
    if (state && (s || '') !== state) return false;
    return true;
  }

  private sortRentalListingRows(
    rows: PublicRentalListingRow[],
    sort: RentalSortNormalized
  ): PublicRentalListingRow[] {
    const copy = [...rows];
    if (sort === 'fastest') {
      copy.sort((a, b) => this.compareRentalByDistance(a, b));
      return copy;
    }
    if (sort === 'cheapest') {
      copy.sort((a, b) => {
        const ah = rentalPricePerHour(a);
        const bh = rentalPricePerHour(b);
        if (ah !== bh) return ah - bh;
        return rentalPricePerDay(a) - rentalPricePerDay(b);
      });
      return copy;
    }
    if (sort === 'expensive') {
      copy.sort((a, b) => {
        const ah = rentalPricePerHour(a);
        const bh = rentalPricePerHour(b);
        if (ah !== bh) return bh - ah;
        return rentalPricePerDay(b) - rentalPricePerDay(a);
      });
      return copy;
    }
    copy.sort((a, b) => rentalListingUpdatedAtMs(b) - rentalListingUpdatedAtMs(a));
    return copy;
  }

  private compareRentalByDistance(
    a: PublicRentalListingRow,
    b: PublicRentalListingRow
  ): number {
    const av = a.distance_value ?? Number.POSITIVE_INFINITY;
    const bv = b.distance_value ?? Number.POSITIVE_INFINITY;
    if (av !== bv) return av - bv;
    return rentalListingUpdatedAtMs(b) - rentalListingUpdatedAtMs(a);
  }

  private formatRentalAddressForGoogle(address: {
    latitude?: number | null;
    longitude?: number | null;
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    state: string;
    postal_code?: string;
    country: string;
  }): string {
    if (address.latitude != null && address.longitude != null) {
      return `${address.latitude},${address.longitude}`;
    }
    return [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ]
      .filter(Boolean)
      .join(', ');
  }

  private collectRentalListingAddressIds(rows: PublicRentalListingRow[]): string[] {
    return Array.from(
      new Set(
        rows
          .map((r) => r.business_location?.address?.id)
          .filter(Boolean) as string[]
      )
    );
  }

  private attachDistanceToRentalRows(
    rows: PublicRentalListingRow[],
    matrix: {
      rows: Array<{
        elements: Array<{
          status: string;
          distance?: { text: string; value: number };
          duration?: { text: string; value: number };
        }>;
      }>;
    },
    destinationIds: string[]
  ): PublicRentalListingRow[] {
    const elements = matrix.rows?.[0]?.elements || [];
    return rows.map((row) => {
      const addressId = row.business_location?.address?.id;
      const idx = addressId ? destinationIds.indexOf(addressId) : -1;
      const el = idx >= 0 ? elements[idx] : null;
      const hasDistance =
        el?.status === 'OK' && el?.distance && el?.duration;
      return {
        ...row,
        distance_text:
          hasDistance && el?.distance ? el.distance.text : undefined,
        duration_text:
          hasDistance && el?.duration ? el.duration.text : undefined,
        distance_value:
          hasDistance && el?.distance ? el.distance.value : undefined,
      };
    });
  }

  private rentalDistanceCacheTtlSeconds(): number {
    return (
      this.configService.get<number>(
        'GOOGLE_INVENTORY_DISTANCE_CACHE_TTL',
        RENTAL_DISTANCE_CACHE_TTL
      ) ?? RENTAL_DISTANCE_CACHE_TTL
    );
  }

  private normalizeAddressForDistanceFmt(a: {
    address_line_1?: string;
    address_line_2?: string | null;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    latitude?: number | null;
    longitude?: number | null;
  }) {
    return {
      ...a,
      city: a.city ?? '',
      state: a.state ?? '',
      address_line_1: a.address_line_1 ?? '',
      country: a.country ?? '',
    };
  }

  private async enrichRentalListingsWithDistance(
    rows: PublicRentalListingRow[]
  ): Promise<PublicRentalListingRow[]> {
    if (rows.length === 0) return rows;
    try {
      return await this.applyDistanceToRentalRows(rows);
    } catch (error: any) {
      this.logger.warn(
        `Rental distance enrichment skipped: ${error?.message ?? String(error)}`
      );
      return rows;
    }
  }

  private async applyDistanceToRentalRows(
    rows: PublicRentalListingRow[]
  ): Promise<PublicRentalListingRow[]> {
    const origin = await this.addressesService.getCurrentUserPrimaryAddress();
    if (!origin) return rows;
    const destIds = this.collectRentalListingAddressIds(rows);
    if (destIds.length === 0) return rows;
    const destAddresses = await this.addressesService.getAddressesByIds(destIds);
    const destFormatted = destAddresses.map((a) => ({
      id: a.id,
      formatted: this.formatRentalAddressForGoogle(
        this.normalizeAddressForDistanceFmt(a)
      ),
    }));
    const matrix = await this.googleDistanceService.getDistanceMatrixWithCaching(
      origin.id,
      this.formatRentalAddressForGoogle(
        this.normalizeAddressForDistanceFmt(origin)
      ),
      destFormatted,
      { ttlSeconds: this.rentalDistanceCacheTtlSeconds() }
    );
    return this.attachDistanceToRentalRows(
      rows,
      matrix,
      destFormatted.map((d) => d.id)
    );
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
