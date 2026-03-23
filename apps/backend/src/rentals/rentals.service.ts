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
import { DeliveryPinService } from '../orders/delivery-pin.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBusinessRentalItemDto } from './dto/create-business-rental-item.dto';
import { CreateBusinessRentalListingDto } from './dto/create-business-rental-listing.dto';
import { UpdateBusinessRentalItemDto } from './dto/update-business-rental-item.dto';
import { UpdateBusinessRentalListingDto } from './dto/update-business-rental-listing.dto';
import { CreateRentalBookingDto } from './dto/create-rental-booking.dto';
import { CreateRentalRequestDto } from './dto/create-rental-request.dto';
import {
  RespondRentalRequestDto,
  RespondRentalRequestStatusDto,
  UnavailableRentalReasonCode,
} from './dto/respond-rental-request.dto';
import {
  isValidRentalPricingSnapshot,
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

function rentalDayCount(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

/** Browse catalog row: same shape as frontend `RentalListingRow`. */
export interface PublicRentalListingRow {
  id: string;
  base_price_per_day: number;
  min_rental_days: number;
  max_rental_days: number | null;
  pickup_instructions: string;
  dropoff_instructions: string;
  updated_at?: string;
  rental_item: {
    id: string;
    name: string;
    description: string;
    tags: string[];
    currency: string;
    operation_mode: string;
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
  requested_start_at: string;
  requested_end_at: string;
  created_at: string;
  business_response_note?: string | null;
  client_request_note?: string | null;
  unavailable_reason_code?: string | null;
  rental_pricing_snapshot?: unknown;
  responded_at?: string | null;
  expires_at?: string | null;
  rental_location_listing: {
    id: string;
    base_price_per_day: number | string;
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
      rental_bookings: Array<{ start_at: string; end_at: string }>;
    }>(Q.LIST_TAKEN_RENTAL_BOOKING_WINDOWS, { listingId });
    return (res.rental_bookings ?? []).map((b) => ({
      startAt: b.start_at,
      endAt: b.end_at,
    }));
  }

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
    this.assertRentalRequestStartsInFuture(start);
    const listing = await this.fetchListing(dto.rentalLocationListingId);
    this.assertListingBookable(listing);
    const days = rentalDayCount(start, end);
    this.assertDuration(listing, days);
    await this.assertCapacity(listing.id, start, end, listing.units_available);
    const note = dto.clientRequestNote?.trim();
    const row = await this.hasuraSystemService.executeMutation<{
      insert_rental_requests_one: { id: string };
    }>(Q.INSERT_RENTAL_REQUEST, {
      object: {
        client_id: user.client.id,
        rental_location_listing_id: listing.id,
        requested_start_at: dto.requestedStartAt,
        requested_end_at: dto.requestedEndAt,
        status: 'pending',
        client_request_note: note || null,
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
    const respondedAt = new Date().toISOString();
    if (dto.status === RespondRentalRequestStatusDto.available) {
      await this.respondRentalRequestAvailable(requestId, dto, user.id, req, respondedAt);
    } else {
      await this.respondRentalRequestUnavailable(requestId, dto, user.id, respondedAt);
    }
    return { success: true };
  }

  private async respondRentalRequestUnavailable(
    requestId: string,
    dto: RespondRentalRequestDto,
    userId: string,
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
  }

  private async respondRentalRequestAvailable(
    requestId: string,
    dto: RespondRentalRequestDto,
    userId: string,
    req: any,
    respondedAt: string
  ) {
    if (!dto.rentalPricingSnapshot || !isValidRentalPricingSnapshot(dto.rentalPricingSnapshot)) {
      throw new HttpException(
        'rentalPricingSnapshot is required when available',
        HttpStatus.BAD_REQUEST
      );
    }
    if (dto.contractExpiryHours == null) {
      throw new HttpException('contractExpiryHours is required when available', HttpStatus.BAD_REQUEST);
    }
    this.assertSnapshotCurrency(dto.rentalPricingSnapshot, req);
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
    const snap = dto.rentalPricingSnapshot;
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

  async updateBusinessRentalListing(
    listingId: string,
    dto: UpdateBusinessRentalListingDto
  ): Promise<void> {
    const businessId = await this.requireBusinessId();
    await this.assertRentalListingForBusiness(listingId, businessId);
    const changes = this.buildListingUpdateSet(dto);
    if (!Object.keys(changes).length) {
      return;
    }
    await this.assertListingMinMaxAfterPatch(listingId, changes);
    const result = await this.hasuraUserService.executeMutation<{
      update_rental_location_listings_by_pk: { id: string } | null;
    }>(Q.UPDATE_BUSINESS_RENTAL_LISTING, { id: listingId, _set: changes });
    if (!result.update_rental_location_listings_by_pk) {
      throw new HttpException('Update failed', HttpStatus.BAD_REQUEST);
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
    if (dto.min_rental_days !== undefined) {
      out.min_rental_days = dto.min_rental_days;
    }
    if (dto.max_rental_days !== undefined) {
      out.max_rental_days = dto.max_rental_days;
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
      set.min_rental_days === undefined &&
      set.max_rental_days === undefined
    ) {
      return;
    }
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings_by_pk: {
        min_rental_days: number;
        max_rental_days: number | null;
      } | null;
    }>(Q.GET_RENTAL_LISTING_MIN_MAX, { id: listingId });
    const cur = r.rental_location_listings_by_pk;
    if (!cur) {
      return;
    }
    const min =
      (set.min_rental_days as number) ?? cur.min_rental_days;
    const max =
      set.max_rental_days === undefined
        ? cur.max_rental_days
        : (set.max_rental_days as number | null);
    if (max != null && max < min) {
      throw new HttpException(
        'max_rental_days must be >= min_rental_days',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async assertRentalListingForBusiness(
    listingId: string,
    businessId: string
  ): Promise<void> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings_by_pk: {
        rental_item: { business_id: string };
      } | null;
    }>(Q.GET_RENTAL_LISTING_BUSINESS_CHECK, { id: listingId });
    const row = r.rental_location_listings_by_pk;
    if (!row || row.rental_item.business_id !== businessId) {
      throw new HttpException('Listing not found', HttpStatus.NOT_FOUND);
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
    const rowBooking = await this.fetchBookingSummaryByRentalRequestId(dto.rentalRequestId);
    const nested = req.rental_booking as
      | { id?: string; status?: string; contract_expires_at?: string | null }
      | null
      | undefined;
    const existing = rowBooking ?? nested;
    const clientId = user.client.id;
    const userId = user.id;
    if (existing?.status === 'proposed' && existing.id) {
      req.rental_booking = {
        id: existing.id,
        status: existing.status,
        contract_expires_at: existing.contract_expires_at ?? null,
      };
      return this.confirmProposedRentalBooking(
        dto.rentalRequestId,
        req,
        userId,
        clientId
      );
    }
    if (existing?.id) {
      throw new HttpException(
        'A booking already exists for this request',
        HttpStatus.CONFLICT
      );
    }
    return this.createLegacyRentalBooking(dto.rentalRequestId, req, userId, clientId);
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
    clientId: string
  ) {
    const bookingId = req.rental_booking?.id as string;
    const exp = req.rental_booking?.contract_expires_at as string | null | undefined;
    if (!exp || new Date(exp) <= new Date()) {
      throw new HttpException('Contract has expired', HttpStatus.GONE);
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
    try {
      await this.placeHoldForBooking(bookingId, clientId, total, snap.currency);
    } catch (e: any) {
      throw new HttpException(e.message || 'Hold failed', HttpStatus.BAD_REQUEST);
    }
    await this.patchBooking(bookingId, { status: 'confirmed', contract_expires_at: null });
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_STATUS, {
      id: requestId,
      status: 'booked',
    });
    const pin = this.deliveryPinService.generatePin();
    const hash = this.deliveryPinService.hashPin(bookingId, pin);
    await this.setBookingPinHash(bookingId, hash);
    this.deliveryPinService.setPinForClient(bookingId, pin);
    await this.logHistory(bookingId, 'confirmed', 'proposed', userId, 'client', 'Booking confirmed');
    return { success: true, bookingId };
  }

  private async createLegacyRentalBooking(
    requestId: string,
    req: any,
    userId: string,
    clientId: string
  ) {
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
    const bookingRow = await this.insertBookingRow(req, clientId, snap, total);
    const bookingId = bookingRow.insert_rental_bookings_one.id;
    try {
      await this.placeHoldForBooking(bookingId, clientId, total, snap.currency);
    } catch (e: any) {
      await this.deleteBooking(bookingId);
      throw new HttpException(e.message || 'Hold failed', HttpStatus.BAD_REQUEST);
    }
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_STATUS, {
      id: requestId,
      status: 'booked',
    });
    const pin = this.deliveryPinService.generatePin();
    const hash = this.deliveryPinService.hashPin(bookingId, pin);
    await this.setBookingPinHash(bookingId, hash);
    this.deliveryPinService.setPinForClient(bookingId, pin);
    await this.logHistory(bookingId, 'confirmed', null, userId, 'client', 'Booking created');
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
    status: string;
    contract_expires_at?: string | null;
  } | null> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{
        id: string;
        status: string;
        contract_expires_at?: string | null;
      }>;
    }>(Q.GET_RENTAL_BOOKING_BY_RENTAL_REQUEST_ID, { rid: rentalRequestId });
    return r.rental_bookings?.[0] ?? null;
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

  private async insertProposedBookingRow(
    req: any,
    clientId: string,
    snap: RentalPricingSnapshotDto,
    total: number,
    contractExpiresAt: string
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
        status: 'proposed',
        contract_expires_at: contractExpiresAt,
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
      copy.sort((a, b) => rentalPricePerDay(a) - rentalPricePerDay(b));
      return copy;
    }
    if (sort === 'expensive') {
      copy.sort((a, b) => rentalPricePerDay(b) - rentalPricePerDay(a));
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
