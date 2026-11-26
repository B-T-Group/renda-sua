import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AccountsService } from '../accounts/accounts.service';
import { AddressesService } from '../addresses/addresses.service';
import { GoogleDistanceService } from '../google/google-distance.service';
import { MobilePaymentsDatabaseService } from '../mobile-payments/mobile-payments-database.service';
import { MobilePaymentsService, MobilePaymentRequest } from '../mobile-payments/mobile-payments.service';
import { resolveItemCountry } from '../mobile-payments/item-country.util';
import { isCardDepositCurrency, shownSecurityDeposit } from './rental-deposit';
import { geoStateKey } from '../rbac/geo-state.util';
import { listingsInIdOrder, marketFromQuery, pickStoredMarket, type SearchMarket } from './rental-search-id-cache';
import { DeliveryPinService } from '../delivery-pin/delivery-pin.service';
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
import { UpdateRentalRequestDto } from './dto/update-rental-request.dto';
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
import { isRequestUuid, requestPolicyNotFound } from './rental-request-policy';
import { peakConcurrentUnits as sweepPeakUnits } from './rental-capacity';
import {
  buildChangeSummary,
  classifyRentalAccept,
  classifyRentalEdit,
  earliestWindowIso,
  normalizeRequestNote,
  parsePriceConfirmQuote,
  type RentalEditBlock,
  type RentalWindowSnapshot,
} from './rental-request-edit';
import { buildRentalRequestQuote } from './rental-request-quote';
import { paymentBlockedUntilPriceSeen, quoteWithTotalOverride, shouldNotifyPriceChange } from './rental-price-change';
import { resolveCardPaymentPolicy } from './rental-card-window';
import { marketTimeZone } from '../common/market-timezones';
import { cappedContractExpiry, computeRespondBy, earliestRequestStartIso, effectiveRespondBy } from './rental-respond-by';
import { listingDashboardFlag, type DashboardRequestFlagRow } from './rental-dashboard-flag';
import {
  dayHoursPickerViolation,
  depositHourRate,
  listingModesViolation,
  modeViolation,
  type DayHoursViolation,
} from './day-hours/day-hours.rules';
import { RentalCardWindowService } from './inspection/rental-card-window.service';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { refundLateCollectIfDeclined } from './pickup-decline/late-collect-refund';
import type { CollectedPayment } from './pickup-decline/pickup-decline.money';
import type { ListingCardWindow } from './rental-card-window';
import { attachListingCardWindows, inspectedByItem } from './inspection/listing-card-batch';
import { snapshotInspected } from './inspection/inspection-optin';
import { InspectionOptInService } from './inspection/inspection-optin.service';
import { RentalInspectionFlags } from './inspection/rental-inspection-flags.service';
import {
  acceptStartConflict,
  acceptStartNotEnrolled,
  cardWindowRejected,
  inspectionRejected,
  inspectionUnavailable,
  inspectionUpdateRequired,
} from './inspection/rental-inspection.errors';
import {
  acceptStartPaymentRail,
  damageCollectedOnAgree,
  decideInspectionEnrolment,
  DEFAULT_STRIPE_REVIEW_HOURS,
  INSPECTION_CODES,
  STRIPE_AUTH_WINDOW_DAYS,
  STRIPE_WINDOW_MESSAGE,
  OVERTIME_PROMPT_BACKOFF_MS,
  pickupStartAllowed,
  priceEnrolledCapture,
  settlementGate,
  type AcceptAndStartResult,
  type AcceptStartPaymentRail,
  type PickupGateBooking,
  type SettlementGateBooking,
} from './inspection/rental-inspection.policy';
import { pinRetired, startWindowClosed } from './simple-start/simple-start.errors';
import {
  isNoShow,
  listingZoneFor,
  reservedUnpaidDue,
  START_WINDOW_CODE,
  startOpensAt,
  startWindowState,
} from './simple-start/simple-start.policy';
import { ItemActivationValidationService } from '../image-validation/item-activation-validation.service';
import {
  fetchStripeEnabledCountries,
  isLocationPaymentsEnabled,
} from '../inventory-items/inventory-catalog-eligibility.util';
import { InventoryItemsService } from '../inventory-items/inventory-items.service';
import { RentalListingAiReviewService } from '../rental-listing-ai-review/rental-listing-ai-review.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { StripeCaptureService } from '../stripe-payments/stripe-capture.service';
import { StripeCheckoutService } from '../stripe-payments/stripe-checkout.service';
import { StripePaymentsDatabaseService } from '../stripe-payments/stripe-payments-database.service';
import { StripeService } from '../stripe-payments/stripe.service';
import { RetryRentalBookingPaymentDto } from './dto/retry-rental-booking-payment.dto';
import { isActivePersona } from '../users/persona.util';
import { casUpdateRentalBooking } from './rental-booking-cas';
import {
  assertLedgerResult,
  rentalLedgerKey,
  rentalProceedsLeg,
} from './rental-ledger';

const DECLINE_REFUND_DEBIT = `
  query DeclineRefundDebit($key: String!) {
    account_transactions(where: { idempotency_key: { _eq: $key } }, limit: 1) { id }
  }
`;
import {
  decideRentalMomoRetry,
  isRentalMomoUniqueViolation,
  rentalMomoIdempotencyKey,
  newRentalMomoReference,
} from './rental-momo-idempotency';
import {
  formatDistanceMeters,
  haversineMeters,
  parseOptionalLatLng,
} from '../common/geo.utils';
import { resolveRentalListingRejectionReasons } from '../common/moderation-rejection-reason';
import * as Q from './rentals-queries';
import {
  activityOrderForScope,
  activityPageLimit,
  activityStatusesForScope,
  defaultActivityScope,
  earnedFromCompletedSums,
  normalizeActivityScope,
  type ItemActivityStatsQuery,
  type RentalItemActivityScope,
} from './rental-item-activity';

const RENTAL_DISTANCE_CACHE_TTL = 7776000;

export const RENTAL_OVERWRITE_BUSINESS_FORBIDDEN =
  "A rental can only be started with the client's PIN. Contact support if the client cannot share it.";

/** Default security deposit = 8x the listing hourly rate, or 8x (day price / 12) without one (depositHourRate). */
const RENTAL_SECURITY_DEPOSIT_HOURLY_MULTIPLIER = 8;

function cardDepositCurrency(currency: string | null | undefined): boolean {
  return isCardDepositCurrency(currency);
}

const ACCEPT_PICKUP_VERSION = `mutation AcceptPickup($id: uuid!, $version: uuid!, $actor: uuid!) {
  rental_accept_pickup_version(args: { p_booking_id: $id, p_version_id: $version, p_actor: $actor }) { id }
}`;

export type RentalPaymentRail = 'wallet' | 'stripe' | 'mobile_money';

export interface RentalBookingActionResult {
  success: true;
  bookingId: string;
  payment_rail: RentalPaymentRail;
  checkout_url?: string;
  payment_intent_client_secret?: string;
  payment_transaction_id?: string;
  confirmed?: boolean;
  paymentPending?: boolean;
  /** Booking is capacity-held without payment; contract is collected at pickup. */
  reserved?: boolean;
}

export interface RentalReturnSettlement {
  contract: number;
  deposit: number;
  overtimeHours: number;
  overtimeAmount: number;
  /** Final Stripe capture: contract + overtime capped by the deposit. */
  stripeCharge: number;
}

export type RentalListingsSort =
  | 'relevance'
  | 'newest'
  | 'fastest'
  | 'cheapest'
  | 'expensive';

export interface ListPublicRentalListingsQuery {
  country_code?: string;
  state?: string;
  origin_lat?: number;
  origin_lng?: number;
  business_location_id?: string;
  sort?: string;
  page?: number;
  limit?: number;
  q?: string;
  /** Search-first only: also match `q` against the category name. Legacy browse leaves this unset. */
  matchCategoryName?: boolean;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  operation_mode?: string;
}

export interface TopRentalLocationRow {
  id: string;
  name: string;
  logo_url: string | null;
  listing_count: number;
  distance_meters: number | null;
  city?: string | null;
  state?: string | null;
}

export interface ListBusinessRentalRequestsQuery {
  page?: number;
  limit?: number;
  status?: string;
  id?: string;
}

export interface RentalRequestExpiryNotice {
  id: string;
  itemName: string;
  renterName: string;
  window: 'sla' | 'start';
  respondedAt: string | null;
}

export interface PaginatedBusinessRentalRequests {
  requests: any[];
  total: number;
  page: number;
  limit: number;
  expiryNotices: RentalRequestExpiryNotice[];
}

export interface PaginatedPublicRentalListings {
  items: PublicRentalListingRow[];
  total: number;
  page: number;
  limit: number;
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
interface CeilingRow {
  number_value: number | null;
  country_code: string | null;
}

interface RentalRequestRowForClientNotification {
  id: string;
  client_id: string;
  rental_location_listing_id: string;
  units_requested?: number;
  client?: { user_id?: string | null } | null;
  rental_location_listing?: {
    units_available?: number;
    rental_item?: {
      name?: string | null;
      business_id?: string;
      currency?: string;
      business?: { name?: string | null } | null;
    } | null;
    base_price_per_hour?: number | string;
    base_price_per_day?: number | string;
    weekly_availability?: WeeklyAvailabilityRow[];
    business_location?: { address?: { country?: string | null } | null } | null;
  } | null;
  rental_selection_windows?: unknown;
  quoted_total?: number | string | null;
}

/** Browse catalog row: same shape as frontend `RentalListingRow`. */
export interface PublicRentalListingRow {
  id: string;
  is_active?: boolean;
  deleted_at?: string | null;
  moderation_status?: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  /** Day/hour switches (rentals_day_hours_picker_enabled). Missing means both on. */
  offers_daily?: boolean | null;
  offers_hourly?: boolean | null;
  min_rental_hours: number;
  max_rental_hours: number | null;
  units_available: number;
  security_deposit_amount?: number | string | null;
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
    rental_item_images: Array<{
      id: string;
      image_url: string;
      alt_text?: string;
      thumbnail?: string | null;
      thumbnail_status?: string | null;
      display_url?: string | null;
    }>;
    business: {
      id: string;
      name: string;
      is_verified?: boolean;
      is_storefront_visible?: boolean;
      can_accept_orders?: boolean;
    };
  };
  business_location: {
    id: string;
    name: string;
    is_active?: boolean;
    mobile_payment_phone?: { is_verified?: boolean } | null;
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
  mode?: ListingCardWindow['mode'];
  payment_rail?: ListingCardWindow['payment_rail'];
  momo_available?: boolean;
  inspection_enabled?: boolean;
  latest_card_end_at?: string | null;
  card_auth_window_days?: number;
  stripe_review_hours?: number;
  timezone?: string;
}

/** Client “my requests” row (Hasura RLS scopes to current user). */
export interface ClientRentalRequestRow {
  id: string;
  status: string;
  rental_selection_windows?: unknown;
  created_at: string;
  business_response_note?: string | null;
  client_request_note?: string | null;
  units_requested?: number;
  unavailable_reason_code?: string | null;
  quoted_total?: number | string | null;
  price_change_seen_at?: string | null;
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

function compareRentalPrice(a: PublicRentalListingRow, b: PublicRentalListingRow): number {
  const hours = rentalPricePerHour(a) - rentalPricePerHour(b);
  return hours || rentalPricePerDay(a) - rentalPricePerDay(b);
}

function compareListingId(a: { id: string }, b: { id: string }): number {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * Singleton rental orchestration.
 * Request identity comes from nestjs-cls via HasuraUserService (optional explicit RequestContext).
 */
const STORED_RENTAL_MARKET = `query StoredRentalMarket($where: supported_country_states_bool_exp!) {
  supported_country_states(where: $where, limit: 50) { country_code state_name state_key }
}`;

/** Booking states a request cancel or auto-decline may release money for. */
const RELEASABLE_REQUEST_BOOKING_STATUSES = new Set(['proposed', 'cancelled']);

@Injectable()
export class RentalsService {
  private readonly logger = new Logger(RentalsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly accountsService: AccountsService,
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly addressesService: AddressesService,
    private readonly googleDistanceService: GoogleDistanceService,
    private readonly configService: ConfigService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly mobilePaymentsDatabaseService: MobilePaymentsDatabaseService,
    private readonly deliveryPinService: DeliveryPinService,
    private readonly notificationsService: NotificationsService,
    private readonly activationValidation: ItemActivationValidationService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly stripeCheckoutService: StripeCheckoutService,
    private readonly stripePaymentsDatabaseService: StripePaymentsDatabaseService,
    private readonly stripeService: StripeService,
    private readonly stripeCaptureService: StripeCaptureService,
    private readonly rentalListingAiReviewService: RentalListingAiReviewService,
    private readonly inspectionFlags: RentalInspectionFlags,
    private readonly inspectionOptIn: InspectionOptInService,
    private readonly cardWindow: RentalCardWindowService
  ) {}

  async listPublicRentalListings(
    query: ListPublicRentalListingsQuery = {}
  ): Promise<PaginatedPublicRentalListings> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const items = await this.collectPublicRentalListings(query);
    const start = (page - 1) * limit;
    const pageRows = items.slice(start, start + limit);
    return { items: await this.attachCardWindows(pageRows), total: items.length, page, limit };
  }

  /** Full filtered catalog, already sorted. Dated search reorders this by availability. */
  async collectPublicRentalListings(
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
    const baseWhere = await this.buildRentalListingWhere(geo.filterMode, geo.country, geo.state);
    const where = this.applyCatalogFilters(this.whereExcludingActiveProposedContracts(baseWhere), query);
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings: PublicRentalListingRow[];
    }>(Q.LIST_PUBLIC_RENTAL_LISTINGS, { where, order_by: [{ updated_at: 'desc' }, { id: 'asc' }] });
    let rows = r.rental_location_listings ?? [];
    rows = await this.filterListingsByPaymentsEnabled(rows);
    rows = await this.enrichRentalListingsWithDistance(rows, query);
    rows = this.sortRentalListingRows(rows, sort);
    return this.hideMomoDeposits(this.filterListingsByPrice(rows, query.min_price, query.max_price));
  }

  /** Page rows for a cached id list. Order follows `ids`, not the query. */
  async loadPublicRentalListingsByIds(ids: string[]): Promise<PublicRentalListingRow[]> {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) return [];
    const fetched = await this.fetchListingsByIds(unique);
    const visible = await this.filterListingsByPaymentsEnabled(fetched);
    const enriched = await this.enrichRentalListingsWithDistance(this.hideMomoDeposits(visible));
    return listingsInIdOrder(ids, enriched);
  }

  private async fetchListingsByIds(ids: string[]): Promise<PublicRentalListingRow[]> {
    const where = this.whereExcludingActiveProposedContracts({ id: { _in: ids } });
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings: PublicRentalListingRow[];
    }>(Q.LIST_PUBLIC_RENTAL_LISTINGS, { where, order_by: [{ id: 'asc' }] });
    return r.rental_location_listings ?? [];
  }

  async getTopRentalLocations(
    limit = 5,
    query: Pick<
      ListPublicRentalListingsQuery,
      'country_code' | 'state' | 'origin_lat' | 'origin_lng'
    > = {}
  ): Promise<TopRentalLocationRow[]> {
    const take = Math.min(Math.max(limit, 1), 20);
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
    const scanQuery = `
      query ScanRentalLocIds($where: rental_location_listings_bool_exp!, $lim: Int!) {
        rental_location_listings(where: $where, limit: $lim) {
          business_location_id
        }
      }
    `;
    const scanResult = await this.hasuraSystemService.executeQuery(scanQuery, {
      where,
      lim: 5000,
    });
    const scanRows: { business_location_id: string }[] =
      scanResult.rental_location_listings ?? [];
    const counts = new Map<string, number>();
    for (const r of scanRows) {
      const id = r.business_location_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    if (counts.size === 0) return [];
    const origin = await this.resolveRentalListOrigin(query);
    const byId = await this.fetchTopRentalStripLocationsByIds([...counts.keys()]);
    return this.rankTopRentalLocationsByOrigin(counts, byId, origin, take);
  }

  private async fetchTopRentalStripLocationsByIds(ids: string[]): Promise<
    Map<
      string,
      {
        id: string;
        name: string;
        logo_url: string | null;
        address?: {
          city?: string | null;
          state?: string | null;
          latitude?: number | null;
          longitude?: number | null;
        } | null;
      }
    >
  > {
    const locQuery = `
      query TopRentalLocDetails($ids: [uuid!]!) {
        business_locations(
          where: {
            id: { _in: $ids }
            address: { status: { _eq: active } }
          }
        ) {
          id
          name
          logo_url
          address {
            city
            state
            latitude
            longitude
          }
        }
      }
    `;
    const locRes = await this.hasuraSystemService.executeQuery(locQuery, { ids });
    const locRows: Array<{
      id: string;
      name: string;
      logo_url?: string | null;
      address?: {
        city?: string | null;
        state?: string | null;
        latitude?: number | null;
        longitude?: number | null;
      } | null;
    }> = locRes.business_locations ?? [];
    return new Map(
      locRows.map((l) => [l.id, { ...l, logo_url: l.logo_url ?? null }])
    );
  }

  private rankTopRentalLocationsByOrigin(
    counts: Map<string, number>,
    byId: Map<
      string,
      {
        name: string;
        logo_url: string | null;
        address?: {
          city?: string | null;
          state?: string | null;
          latitude?: number | null;
          longitude?: number | null;
        } | null;
      }
    >,
    origin: { lat: number; lng: number } | null,
    take: number
  ): TopRentalLocationRow[] {
    const scored = [...counts.keys()].map((id) => {
      const loc = byId.get(id);
      let distance_meters: number | null = null;
      if (origin && loc?.address) {
        const lat = loc.address.latitude;
        const lng = loc.address.longitude;
        if (lat != null && lng != null) {
          distance_meters = haversineMeters(
            origin.lat,
            origin.lng,
            Number(lat),
            Number(lng)
          );
        }
      }
      return {
        id,
        listing_count: counts.get(id) ?? 0,
        distance_meters,
      };
    });
    if (origin) {
      scored.sort((a, b) => {
        const da = a.distance_meters ?? Infinity;
        const db = b.distance_meters ?? Infinity;
        if (da !== db) return da - db;
        return b.listing_count - a.listing_count;
      });
    } else {
      scored.sort((a, b) => b.listing_count - a.listing_count);
    }
    return scored.slice(0, take).map(({ id, listing_count, distance_meters }) => {
      const loc = byId.get(id);
      return {
        id,
        name: loc?.name ?? '',
        logo_url: loc?.logo_url ?? null,
        listing_count,
        distance_meters:
          origin && distance_meters != null ? distance_meters : null,
        city: loc?.address?.city ?? null,
        state: loc?.address?.state ?? null,
      };
    });
  }

  async listRentalCategories(): Promise<
    Array<{
      id: string;
      name: string;
      slug?: string | null;
      display_order?: number | null;
    }>
  > {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_categories: Array<{
        id: string;
        name: string;
        slug?: string | null;
        display_order?: number | null;
      }>;
    }>(Q.LIST_RENTAL_CATEGORIES);
    return r.rental_categories ?? [];
  }

  async createRentalCategory(rawName: string): Promise<{
    id: string;
    name: string;
    slug: string;
    display_order?: number | null;
  }> {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      throw new HttpException(
        { success: false, message: 'Category name is required' },
        HttpStatus.BAD_REQUEST
      );
    }

    const existingByName = await this.hasuraSystemService.executeQuery<{
      rental_categories: Array<{
        id: string;
        name: string;
        slug: string;
        display_order?: number | null;
      }>;
    }>(Q.FIND_RENTAL_CATEGORY_BY_NAME, { name });
    if (existingByName.rental_categories?.[0]) {
      return existingByName.rental_categories[0];
    }

    const baseSlug = this.slugifyRentalCategory(name);
    const slug = await this.uniqueRentalCategorySlug(baseSlug);
    const maxOrder = (await this.listRentalCategories()).reduce(
      (max, row) => Math.max(max, row.display_order ?? 0),
      0
    );

    const inserted = await this.hasuraSystemService.executeMutation<{
      insert_rental_categories_one: {
        id: string;
        name: string;
        slug: string;
        display_order?: number | null;
      };
    }>(Q.INSERT_RENTAL_CATEGORY, {
      object: {
        name,
        slug,
        display_order: maxOrder + 1,
        is_active: true,
      },
    });
    return inserted.insert_rental_categories_one;
  }

  private slugifyRentalCategory(name: string): string {
    const slug = name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return slug || 'category';
  }

  private async uniqueRentalCategorySlug(baseSlug: string): Promise<string> {
    let candidate = baseSlug;
    for (let i = 0; i < 8; i += 1) {
      const existing = await this.hasuraSystemService.executeQuery<{
        rental_categories: Array<{ id: string }>;
      }>(Q.FIND_RENTAL_CATEGORY_BY_SLUG, { slug: candidate });
      if (!existing.rental_categories?.length) return candidate;
      candidate = `${baseSlug}-${i + 2}`;
    }
    return `${baseSlug}-${Date.now().toString(36)}`;
  }

  private applyCatalogFilters(
    base: Record<string, unknown>,
    query: ListPublicRentalListingsQuery
  ): Record<string, unknown> {
    const parts: Record<string, unknown>[] = [base];
    const q = query.q?.trim();
    if (q) {
      parts.push({
        _or: [
          { rental_item: { name: { _ilike: `%${q}%` } } },
          { rental_item: { description: { _ilike: `%${q}%` } } },
          ...(query.matchCategoryName
            ? [{ rental_item: { rental_category: { name: { _ilike: `%${q}%` } } } }]
            : []),
        ],
      });
    }
    if (query.category_id?.trim()) {
      parts.push({
        rental_item: {
          rental_category_id: { _eq: query.category_id.trim() },
        },
      });
    }
    const mode = query.operation_mode?.trim();
    if (mode === 'business_operated' || mode === 'take_home') {
      parts.push({
        rental_item: {
          operation_mode: { _eq: mode },
        },
      });
    }
    const locId = query.business_location_id?.trim();
    if (locId) {
      parts.push({ business_location_id: { _eq: locId } });
    }
    return parts.length === 1 ? parts[0]! : { _and: parts };
  }

  private filterListingsByPrice(
    rows: PublicRentalListingRow[],
    minPrice?: number,
    maxPrice?: number
  ): PublicRentalListingRow[] {
    const min =
      minPrice != null && !Number.isNaN(Number(minPrice))
        ? Number(minPrice)
        : null;
    const max =
      maxPrice != null && !Number.isNaN(Number(maxPrice))
        ? Number(maxPrice)
        : null;
    if (min == null && max == null) return rows;
    return rows.filter((row) => {
      const price = rentalPricePerHour(row);
      if (min != null && price < min) return false;
      if (max != null && price > max) return false;
      return true;
    });
  }

  private async attachCardWindows(rows: PublicRentalListingRow[]): Promise<PublicRentalListingRow[]> {
    if (!rows.length || !this.cardWindow) return rows;
    return attachListingCardWindows(rows, {
      optInEnabled: (country) => this.optInFlag(country),
      stampsForItems: (ids) => this.stampsOrEmpty(ids),
      forCountry: (country, inspected) => this.cardWindow.forCountry(country, new Date(), inspected),
    });
  }

  async listingWindowByItem(
    rows: Array<{ country?: string | null; itemId?: string | null }>
  ): Promise<Map<string, boolean | undefined>> {
    return inspectedByItem(rows.map((row) => this.cardListing(row)), {
      optInEnabled: (country) => this.optInFlag(country),
      stampsForItems: (ids) => this.stampsOrEmpty(ids),
    });
  }

  private cardListing(row: { country?: string | null; itemId?: string | null }) {
    return {
      rental_item: { id: row.itemId },
      business_location: { address: { country: row.country } },
    };
  }

  private stampsOrEmpty(ids: string[]): Promise<Map<string, boolean>> {
    const batch = this.inspectionOptIn?.stampsForItems;
    if (typeof batch !== 'function') return Promise.resolve(new Map());
    return batch.call(this.inspectionOptIn, ids);
  }

  private hideMomoDeposits(rows: PublicRentalListingRow[]): PublicRentalListingRow[] {
    return rows.map((row) => this.hideMomoDeposit(row));
  }

  private hideMomoDeposit(row: PublicRentalListingRow): PublicRentalListingRow {
    const amount = shownSecurityDeposit(row.rental_item?.currency, row.security_deposit_amount);
    if (amount === Number(row.security_deposit_amount)) return row;
    return { ...row, security_deposit_amount: amount };
  }

  private async rejectUnfitCardRequest(
    listing: {
      rental_item?: { id?: string | null } | null;
      business_location?: { address?: { country?: string | null } | null } | null;
    },
    endIso: string
  ): Promise<void> {
    const country = resolveItemCountry(listing?.business_location?.address?.country);
    if (!this.inspectionFlags?.cardWindowGuardEnabled) return;
    if (!(await this.inspectionFlags.cardWindowGuardEnabled(country))) return;
    const inspected = (await this.optInFlag(country))
      ? await this.inspectionOptIn.stampsNewBooking(listing?.rental_item?.id)
      : undefined;
    this.throwIfCardEndMisses(endIso, await this.stripeWindowFields(country, inspected));
  }

  private throwIfCardEndMisses(endIso: string, fields: ListingCardWindow): void {
    if (!fields.latest_card_end_at) return;
    if (new Date(endIso).getTime() <= new Date(fields.latest_card_end_at).getTime()) return;
    throw cardWindowRejected(INSPECTION_CODES.STRIPE_WINDOW, STRIPE_WINDOW_MESSAGE, fields);
  }

  private async stripeWindowFields(country: string | null, inspected?: boolean): Promise<ListingCardWindow> {
    if (!this.cardWindow) return emptyStripeFields();
    if (inspected === undefined) return this.cardWindow.forCountry(country);
    return this.cardWindow.forCountry(country, new Date(), inspected);
  }

  private async knownInspected(country: string | null, row: { inspection_policy_version?: number | null }): Promise<boolean | undefined> {
    if (!(await this.optInFlag(country))) return undefined;
    if (!row || !('inspection_policy_version' in row)) return undefined;
    return snapshotInspected(row.inspection_policy_version);
  }

  private async optInFlag(country?: string | null): Promise<boolean> {
    const flags = this.inspectionFlags as { optInEnabled?: (code?: string | null) => Promise<boolean> } | undefined;
    if (typeof flags?.optInEnabled !== 'function') return false;
    return flags.optInEnabled(country);
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
    if (row.is_active !== true) {
      return null;
    }
    if (row.deleted_at || row.rental_item?.deleted_at) {
      return null;
    }
    if (row.business_location?.is_active !== true) {
      return null;
    }
    if (row.rental_item?.business?.is_storefront_visible !== true) {
      return null;
    }
    if (!(await this.isListingPaymentsEnabled(row))) {
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
    const enriched = await this.enrichRentalListingsWithDistance([row], query);
    const visible = this.hideMomoDeposit(enriched[0] ?? row);
    const [withCard] = await this.attachCardWindows([visible]);
    return withCard ?? visible;
  }

  async listTakenRentalBookingWindowsForPublicListing(
    listingId: string,
    query: ListPublicRentalListingsQuery = {}
  ): Promise<{
    windows: Array<{ startAt: string; endAt: string; unitsBooked: number }>;
    card: ListingCardWindow | null;
  } | null> {
    const visible = await this.getPublicRentalListingById(listingId, query);
    if (!visible) {
      return null;
    }
    const now = new Date().toISOString();
    const res = await this.hasuraSystemService.executeQuery<{
      rental_booking_windows: Array<{
        start_at: string;
        end_at: string;
        rental_booking?: { units_booked?: number | null } | null;
      }>;
    }>(Q.LIST_TAKEN_RENTAL_BOOKING_WINDOWS, { listingId, now });
    const windows = (res.rental_booking_windows ?? []).map((b) => ({
      startAt: b.start_at,
      endAt: b.end_at,
      unitsBooked: Math.max(1, Number(b.rental_booking?.units_booked) || 1),
    }));
    return { windows, card: readCardWindowFields(visible) };
  }

  async createRentalRequest(dto: CreateRentalRequestDto) {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException('Only clients can create requests', HttpStatus.FORBIDDEN);
    }
    const listing = await this.fetchListing(dto.rentalLocationListingId);
    await this.assertListingBookable(listing);
    const unitsRequested = this.normalizeUnitsRequested(dto.unitsRequested);
    const unitsAvailable = Math.max(1, Number(listing.units_available) || 1);
    if (unitsRequested > unitsAvailable) {
      throw new HttpException(
        'unitsRequested exceeds listing units_available',
        HttpStatus.BAD_REQUEST
      );
    }
    const plan = this.buildCreateRentalRequestPlan(dto);
    await this.validateRentalRequestWindowsPlan(plan, listing, unitsRequested);
    await this.rejectUnfitCardRequest(listing, plan.envelopeEndIso);
    const note = dto.clientRequestNote?.trim();
    const inspectionPolicyVersion = await this.requestPolicyVersion(listing);
    const quote = buildRentalRequestQuote({
      windows: plan.windows,
      dayRate: Number(listing.base_price_per_day),
      hourRate: Number(listing.base_price_per_hour),
      units: unitsRequested,
      currency: listing.rental_item?.currency || 'XAF',
      securityDepositPerUnit: Number(listing.security_deposit_amount) || 0,
      computedAt: new Date().toISOString(),
    });
    const row = await this.hasuraSystemService.executeMutation<{
      insert_rental_requests_one: { id: string };
    }>(Q.INSERT_RENTAL_REQUEST, {
      object: {
        client_id: user.client.id,
        rental_location_listing_id: listing.id,
        // Legacy NOT NULL envelope columns; also stored as selection windows.
        requested_start_at: plan.envelopeStartIso,
        requested_end_at: plan.envelopeEndIso,
        rental_selection_windows: plan.selectionWindowsJson,
        status: 'pending',
        units_requested: unitsRequested,
        client_request_note: note || null,
        inspection_policy_version: inspectionPolicyVersion,
        quoted_total: quote?.quotedTotal ?? null,
        rental_pricing_snapshot: quote?.snapshot ?? null,
        respond_by: computeRespondBy({
          createdAt: new Date().toISOString(),
          startAt: plan.envelopeStartIso,
        }).respondBy,
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
    return { success: true, requestId, inspection_policy_version: inspectionPolicyVersion };
  }

  private async requestPolicyVersion(listing: any): Promise<number | null> {
    const country = listing?.business_location?.address?.country ?? null;
    return this.listingInspectionPolicy(country, listing?.rental_item?.id);
  }

  private assertModifyVersion(
    req: { client_id: string; status: string; edit_version?: number },
    clientId: string,
    expectedVersion: number
  ): void {
    if (req.client_id !== clientId) {
      throw new HttpException(
        { message: 'Forbidden', code: 'RENTAL_REQUEST_FORBIDDEN' },
        HttpStatus.FORBIDDEN
      );
    }
    if (req.status !== 'pending') throw this.editHttpError('not_pending');
    if (Number(req.edit_version ?? 1) !== expectedVersion) {
      throw this.editHttpError('stale_version');
    }
  }

  private editDtoWithStoredSchedule(
    req: { rental_selection_windows?: unknown },
    dto: UpdateRentalRequestDto
  ): UpdateRentalRequestDto {
    if (dto.windows?.length || (dto.requestedStartAt && dto.requestedEndAt)) return dto;
    const windows = this.windowSnapshots(req).flatMap((row) => {
      if (!row.start_at || !row.end_at) return [];
      const billing = row.billing === 'all_day' ? ('all_day' as const) : undefined;
      return [{
        requestedStartAt: row.start_at,
        requestedEndAt: row.end_at,
        ...(billing ? { billing, calendarDate: row.calendar_date } : {}),
      }];
    });
    if (!windows.length) return dto;
    return { ...dto, windows };
  }

  async modifyRentalRequest(requestId: string, dto: UpdateRentalRequestDto) {
    if (!(await this.isModifyRequestEnabled())) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    const user = await this.requireModifyClient();
    const req = await this.fetchRequest(requestId);
    this.assertModifyVersion(req, user.clientId, dto.expectedVersion);
    const edit = this.editDtoWithStoredSchedule(req, dto);
    const plan = this.buildCreateRentalRequestPlan(edit as unknown as CreateRentalRequestDto);
    const units = this.normalizeUnitsRequested(dto.unitsRequested ?? req.units_requested);
    this.assertModifyStillOpen(req, user.clientId, dto.expectedVersion, plan.envelopeStartIso);
    await this.validateRentalRequestWindowsPlan(plan, req.rental_location_listing, units);
    await this.rejectUnfitCardRequest(req.rental_location_listing, plan.envelopeEndIso);
    return this.commitRentalRequestEdit(requestId, user, req, edit, plan, units);
  }

  private async applyRentalRequestEdit(
    requestId: string,
    user: { id: string; clientId: string },
    expectedVersion: number,
    windows: RentalWindowSnapshot[],
    units: number,
    note: string | undefined,
    changeSummary: ReturnType<typeof buildChangeSummary>,
    confirmedAmount: number | null,
    confirmedCurrency: string | null
  ) {
    try {
      const saved = await this.hasuraSystemService.executeMutation<{
        apply_rental_request_edit: Array<{ version: number; quoted_total: string | number | null }>;
      }>(Q.APPLY_RENTAL_REQUEST_EDIT, {
        requestId,
        clientId: user.clientId,
        actorId: user.id,
        expectedVersion,
        windows,
        units,
        note: normalizeRequestNote(note),
        changeSummary,
        now: new Date().toISOString(),
        confirmedAmount,
        confirmedCurrency,
      });
      const row = saved.apply_rental_request_edit?.[0];
      if (!row) throw new HttpException('Could not save changes', HttpStatus.CONFLICT);
      return { version: Number(row.version), quoted_total: row.quoted_total == null ? null : Number(row.quoted_total) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw this.mapEditSqlError(error);
    }
  }

  private async notifyBusinessOfRentalEdit(
    req: { rental_location_listing?: { rental_item?: { name?: string; business?: { user_id?: string } } } },
    requestId: string,
    clientName: string
  ): Promise<void> {
    const businessUserId = req.rental_location_listing?.rental_item?.business?.user_id;
    if (!businessUserId) return;
    await this.notificationsService.sendBusinessRentalRequestUpdated({
      businessUserId,
      requestId,
      rentalItemName: req.rental_location_listing?.rental_item?.name ?? 'Rental',
      clientName,
    });
  }

  private windowSnapshots(req: { rental_selection_windows?: unknown }): RentalWindowSnapshot[] {
    const rows = Array.isArray(req.rental_selection_windows) ? req.rental_selection_windows : [];
    return rows.map((row: RentalWindowSnapshot) => ({
      billing: row.billing,
      calendar_date: row.calendar_date,
      start_at: row.start_at,
      end_at: row.end_at,
    }));
  }

  private editHttpError(block: RentalEditBlock | 'forbidden' | 'missing_version'): HttpException {
    const mapped: Record<string, { status: number; code: string; message: string }> = {
      not_pending: { status: 409, code: 'RENTAL_REQUEST_ALREADY_ACCEPTED', message: 'The business already accepted this rental.' },
      stale_version: { status: 409, code: 'RENTAL_REQUEST_STALE_VERSION', message: 'This request was updated. Review the latest version.' },
      window_closed: { status: 409, code: 'RENTAL_REQUEST_WINDOW_CLOSED', message: 'Changes close 2 hours before the rental starts.' },
      unavailable: { status: 409, code: 'RENTAL_REQUEST_UNAVAILABLE', message: 'Not available for these dates' },
      forbidden: { status: 403, code: 'RENTAL_REQUEST_FORBIDDEN', message: 'Forbidden' },
      missing_version: { status: 400, code: 'RENTAL_REQUEST_VERSION_REQUIRED', message: 'expectedVersion is required' },
    };
    const row = mapped[block] ?? mapped.unavailable;
    return new HttpException({ message: row.message, code: row.code }, row.status);
  }

  private mapEditSqlError(error: unknown): HttpException {
    const text = error instanceof Error ? error.message : String(error);
    const quote = parsePriceConfirmQuote(text);
    if (quote) return this.priceConfirmError(quote);
    if (text.includes('rental_request_not_pending')) return this.editHttpError('not_pending');
    if (text.includes('rental_request_forbidden')) return this.editHttpError('forbidden');
    if (text.includes('rental_request_stale_version')) return this.editHttpError('stale_version');
    if (text.includes('rental_request_window_closed')) return this.editHttpError('window_closed');
    if (text.includes('rental_request_unavailable')) return this.editHttpError('unavailable');
    return new HttpException('Could not save changes', HttpStatus.CONFLICT);
  }

  private priceConfirmError(quote: NonNullable<ReturnType<typeof parsePriceConfirmQuote>>): HttpException {
    return new HttpException(
      {
        message: 'The quoted total went up. Confirm the new total to save.',
        code: 'PRICE_CONFIRM_REQUIRED',
        quote,
      },
      HttpStatus.CONFLICT
    );
  }

  private async isModifyRequestEnabled(): Promise<boolean> {
    const rows = await this.hasuraSystemService.executeQuery<{
      application_configurations: Array<{ boolean_value: boolean | null; country_code: string | null }>;
    }>(Q.GET_MODIFY_REQUEST_FLAG, {});
    const global = (rows.application_configurations ?? []).find((row) => row.country_code == null);
    return global?.boolean_value === true;
  }

  private assertRespondVersion(
    req: { status: string; edit_version?: number },
    dto: RespondRentalRequestDto,
    requireVersion: boolean
  ): void {
    const decision = classifyRentalAccept({
      status: req.status,
      version: Number(req.edit_version ?? 1),
      expectedVersion: dto.expectedVersion ?? null,
      requireVersion,
    });
    if (decision === 'ok') return;
    if (decision === 'not_pending') {
      throw new HttpException('Request is not pending', HttpStatus.BAD_REQUEST);
    }
    throw this.editHttpError(decision);
  }

  private async persistRentalResponse(vars: {
    id: string;
    version?: number;
    status: string;
    snapshot: unknown;
    note: string | null;
    unavailableReasonCode: string | null;
    requestExpiresAt: string | null;
    respondedAt: string;
    userId: string;
  }): Promise<void> {
    const mutation = vars.version == null ? Q.UPDATE_RENTAL_REQUEST_RESPOND : Q.UPDATE_RENTAL_REQUEST_RESPOND_CAS;
    const saved = await this.hasuraSystemService.executeMutation<{
      update_rental_requests: { affected_rows: number } | null;
    }>(mutation, vars);
    if ((saved.update_rental_requests?.affected_rows ?? 0) < 1) {
      throw await this.rentalRespondConflict(vars.id);
    }
  }

  private async rentalRespondConflict(id: string): Promise<HttpException> {
    const fresh = await this.fetchRequest(id);
    if (fresh.status !== 'pending') return this.editHttpError('not_pending');
    return this.editHttpError('stale_version');
  }

  private async requireModifyClient(): Promise<{ id: string; clientId: string; name: string }> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException('Only clients can modify rental requests', HttpStatus.FORBIDDEN);
    }
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'A client';
    return { id: user.id, clientId: user.client.id, name };
  }

  private assertModifyStillOpen(
    req: Awaited<ReturnType<RentalsService['fetchRequest']>>,
    clientId: string,
    expectedVersion: number,
    nextStartIso: string
  ): void {
    if (req.client_id !== clientId) {
      throw new HttpException({ message: 'Forbidden', code: 'RENTAL_REQUEST_FORBIDDEN' }, HttpStatus.FORBIDDEN);
    }
    const block = classifyRentalEdit({
      status: req.status,
      version: Number(req.edit_version ?? 1),
      expectedVersion,
      currentStartIso: earliestWindowIso(this.windowSnapshots(req)),
      nextStartIso,
      nowMs: Date.now(),
      unitsFree: true,
    });
    if (block !== 'ok') throw this.editHttpError(block);
  }

  private async commitRentalRequestEdit(
    requestId: string,
    user: { id: string; clientId: string; name: string },
    req: Awaited<ReturnType<RentalsService['fetchRequest']>>,
    dto: UpdateRentalRequestDto,
    plan: ReturnType<RentalsService['buildCreateRentalRequestPlan']>,
    units: number
  ) {
    const previous = this.windowSnapshots(req);
    const next = plan.windows.map((row) => ({
      billing: row.billing,
      calendar_date: row.calendarDate,
      start_at: row.start.toISOString(),
      end_at: row.end.toISOString(),
    }));
    const summary = buildChangeSummary(
      {
        windows: previous,
        units: Number(req.units_requested) || 1,
        note: req.client_request_note,
      },
      { windows: next, units, note: dto.clientRequestNote ?? null }
    );
    const saved = await this.applyRentalRequestEdit(
      requestId,
      user,
      dto.expectedVersion,
      next,
      units,
      dto.clientRequestNote,
      summary,
      dto.confirmedTotal?.amount ?? null,
      dto.confirmedTotal?.currency ?? null
    );
    await this.notifyBusinessOfRentalEdit(req, requestId, user.name);
    return { success: true, requestId, editVersion: saved.version, quotedTotal: saved.quoted_total };
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
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException('Only businesses can respond', HttpStatus.FORBIDDEN);
    }
    const req = await this.fetchRequest(requestId);
    if (req.rental_location_listing.rental_item.business_id !== user.business.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    this.assertRespondVersion(req, dto, await this.isModifyRequestEnabled());
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
    await this.persistRentalResponse({
      id: requestId,
      version: dto.expectedVersion,
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
    const now = new Date();
    const contractExpiresAt = this.contractExpiryIso(req, dto.contractExpiryHours, now);
    await this.assertRespondWindowOpen(req, now);
    const listingId = req.rental_location_listing_id;
    const unitsRequested = this.normalizeUnitsRequested(req.units_requested);
    const unitsAvailable = Math.max(
      1,
      Number(req.rental_location_listing?.units_available) || 1
    );
    await this.assertCapacityForRequestWindows(
      listingId,
      unitsAvailable,
      req,
      unitsRequested
    );
    const snap = await this.acceptedSnapshot(req, dto, computedSnapshot);
    const total = Number(snap.total);
    const clientId = req.client_id;
    let bookingId: string | null = null;
    try {
      const ins = await this.insertProposedBookingRow(req, clientId, snap, total, contractExpiresAt);
      bookingId = ins.insert_rental_bookings_one.id;
      await this.persistRentalResponse({
        id: requestId,
        version: dto.expectedVersion,
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
      await this.notifyClientIfPriceChanged(req, snap.total, requestId);
    } catch (e: any) {
      if (bookingId) await this.deleteBooking(bookingId);
      throw this.respondFailure(e);
    }
  }

  private respondFailure(error: any): HttpException {
    if (error instanceof HttpException) return error;
    const text = String(error?.message ?? error);
    if (text.includes('rental_request_unavailable')) {
      return new HttpException('No units available for these dates', HttpStatus.CONFLICT);
    }
    return new HttpException(error?.message || 'Failed to respond', HttpStatus.BAD_REQUEST);
  }

  private async assertRespondWindowOpen(req: any, now: Date): Promise<void> {
    const flags = await this.loadDashboardRequestFlags();
    const country = req.rental_location_listing?.business_location?.address?.country;
    if (!listingDashboardFlag(flags, country)) return;
    const decision = effectiveRespondBy({
      createdAt: req.created_at,
      respondBy: req.respond_by,
      startAt: earliestRequestStartIso(req),
    });
    if (now.getTime() <= Date.parse(decision.respondBy)) return;
    throw new HttpException(
      { message: 'This request has expired', code: 'RENTAL_REQUEST_EXPIRED' },
      HttpStatus.CONFLICT
    );
  }

  private async acceptedSnapshot(
    req: any,
    dto: RespondRentalRequestDto,
    computed: RentalPricingSnapshotDto
  ): Promise<RentalPricingSnapshotDto> {
    try {
      const enabled = await this.totalOverrideEnabled(req);
      const ceiling = await this.ceilingForOverride(req, dto, computed, enabled);
      return quoteWithTotalOverride(computed, dto.totalOverride, enabled, ceiling);
    } catch (error: any) {
      throw new HttpException(this.overrideErrorMessage(error), HttpStatus.BAD_REQUEST);
    }
  }

  private async ceilingForOverride(
    req: any,
    dto: RespondRentalRequestDto,
    computed: RentalPricingSnapshotDto,
    enabled: boolean
  ): Promise<number | null> {
    if (!enabled || !this.overrideNeedsCeiling(dto.totalOverride, computed.total)) return null;
    const country = resolveItemCountry(req.rental_location_listing?.business_location?.address?.country);
    return this.overrideCeiling(computed.currency, country);
  }

  private overrideNeedsCeiling(totalOverride: number | null | undefined, quote: number): boolean {
    return totalOverride != null && totalOverride > Number(quote);
  }

  private overrideErrorMessage(error: any): string {
    if (error?.message === 'TOTAL_OVERRIDE_DISABLED') return 'Changing the total is not enabled';
    if (error?.message === 'TOTAL_OVERRIDE_TOO_HIGH') {
      return 'Enter a total up to the quote, at most 10 times the quote, or within the configured currency limit';
    }
    if (error?.message === 'TOTAL_OVERRIDE_CEILING_UNAVAILABLE') {
      return 'The currency limit could not be loaded. Try again.';
    }
    return 'Enter a total greater than zero';
  }

  private async totalOverrideEnabled(req: any): Promise<boolean> {
    if (!(await this.isModifyRequestEnabled())) return false;
    const flags = await this.loadDashboardRequestFlags();
    const country = req.rental_location_listing?.business_location?.address?.country;
    return listingDashboardFlag(flags, country);
  }

  private async overrideCeiling(currency: string | undefined, country?: string | null): Promise<number | null> {
    const code = (currency ?? '').trim().toUpperCase();
    if (!code) return null;
    const rows = await this.loadOverrideCeilings(code, country);
    return this.pickedCeiling(rows, country);
  }

  private async loadOverrideCeilings(currency: string, country?: string | null): Promise<CeilingRow[]> {
    try {
      const res = await this.hasuraSystemService.executeQuery<{
        application_configurations: CeilingRow[];
      }>(Q.RENTAL_TOTAL_OVERRIDE_MAX, { currency, country: (country ?? '').trim().toUpperCase() });
      return res.application_configurations ?? [];
    } catch (error: any) {
      throw new Error('TOTAL_OVERRIDE_CEILING_UNAVAILABLE');
    }
  }

  private pickedCeiling(rows: CeilingRow[], country?: string | null): number | null {
    const code = (country ?? '').trim().toUpperCase();
    const scoped = code ? rows.find((row) => (row.country_code ?? '').toUpperCase() === code) : undefined;
    return this.positiveCeiling(scoped) ?? this.positiveCeiling(rows.find((row) => row.country_code == null));
  }

  private positiveCeiling(row?: CeilingRow): number | null {
    const value = Number(row?.number_value);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  }

  private async notifyClientIfPriceChanged(
    req: RentalRequestRowForClientNotification,
    accepted: number,
    requestId: string
  ): Promise<void> {
    if (!shouldNotifyPriceChange(req.quoted_total, accepted)) return;
    const clientUserId = req.client?.user_id;
    if (!clientUserId) return;
    await this.notificationsService.sendClientRentalPriceChanged({
      clientUserId,
      requestId,
      rentalItemName: req.rental_location_listing?.rental_item?.name ?? 'rental',
      quoted: Number(req.quoted_total),
      accepted,
    });
  }

  private assertPriceChangeSeen(req: {
    quoted_total?: unknown;
    price_change_seen_at?: string | null;
    rental_pricing_snapshot?: { total?: unknown } | null;
  }): void {
    const accepted = Number(req.rental_pricing_snapshot?.total);
    if (!paymentBlockedUntilPriceSeen({ quoted: req.quoted_total, accepted, seenAt: req.price_change_seen_at })) return;
    throw new HttpException('PRICE_CHANGE_UNSEEN', HttpStatus.CONFLICT);
  }

  private async assertAcceptedPriceSeen(requestId?: string): Promise<void> {
    if (!requestId) return;
    this.assertPriceChangeSeen(await this.fetchRequest(requestId));
  }

  async markRentalPriceChangeSeen(requestId: string): Promise<{ success: boolean }> {
    const user = await this.hasuraUserService.getUser();
    const clientId = user.client?.id;
    if (!clientId) throw new HttpException('Only the renter can confirm the price', HttpStatus.FORBIDDEN);
    const row = await this.fetchRequest(requestId);
    if (row.client_id !== clientId) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    if (row.status !== 'available') {
      throw new HttpException(
        { message: 'The price can be confirmed after the business accepts', code: 'PRICE_CHANGE_NOT_OPEN' },
        HttpStatus.CONFLICT
      );
    }
    const saved = await this.hasuraSystemService.executeQuery<{
      update_rental_requests: { affected_rows: number } | null;
    }>(
      `mutation SeeRentalPrice($id: uuid!, $seen: timestamptz!) {
        update_rental_requests(
          where: { id: { _eq: $id }, status: { _eq: available } }
          _set: { price_change_seen_at: $seen }
        ) { affected_rows }
      }`,
      { id: requestId, seen: new Date().toISOString() }
    );
    if ((saved.update_rental_requests?.affected_rows ?? 0) < 1) {
      throw new HttpException('The price can be confirmed after the business accepts', HttpStatus.CONFLICT);
    }
    return { success: true };
  }

  async getBusinessRentalItems(): Promise<any[]> {
    const businessId = await this.requireBusinessId();
    const r = await this.hasuraSystemService.executeQuery<{
      rental_items: any[];
    }>(Q.GET_BUSINESS_RENTAL_ITEMS, { businessId });
    return r.rental_items ?? [];
  }

  async getBusinessRentalRequests(
    query: ListBusinessRentalRequestsQuery = {}
  ): Promise<PaginatedBusinessRentalRequests> {
    const businessId = await this.requireBusinessId();
    const flags = await this.loadDashboardRequestFlags();
    const enabled = flags.some((row) => row.boolean_value === true);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = this.businessRequestLimit(query, enabled);
    const listed = await this.queryBusinessRequests(businessId, query, page, limit, enabled);
    const expiryNotices = enabled ? await this.recentNoResponseNotices(businessId) : [];
    const requests = this.withRespondBy(listed.requests, flags);
    const withFacts = enabled ? await this.attachRequestCardFacts(requests, flags) : requests;
    return { ...listed, requests: withFacts, expiryNotices };
  }

  private businessRequestLimit(query: ListBusinessRentalRequestsQuery, enabled: boolean): number {
    const requested = Number(query.limit);
    const hasLimit = Number.isFinite(requested) && requested > 0;
    const pending = query.status?.trim() === 'pending';
    if (enabled && pending) return Math.min(100, hasLimit ? requested : 100);
    return Math.min(100, hasLimit ? requested : 50);
  }

  private async queryBusinessRequests(
    businessId: string,
    query: ListBusinessRentalRequestsQuery,
    page: number,
    limit: number,
    soonestFirst: boolean
  ): Promise<Omit<PaginatedBusinessRentalRequests, 'expiryNotices'>> {
    const offset = (page - 1) * limit;
    const where = this.buildBusinessRequestsWhere(businessId, query.status, soonestFirst ? query.id : undefined);
    const orderBy = soonestFirst
      ? [{ requested_start_at: 'asc' }, { created_at: 'asc' }]
      : [{ created_at: 'desc' }];
    const r = await this.hasuraSystemService.executeQuery<{
      rental_requests: any[];
      rental_requests_aggregate: { aggregate: { count: number } | null } | null;
    }>(Q.GET_BUSINESS_RENTAL_REQUESTS, { where, limit, offset, orderBy });
    return {
      requests: r.rental_requests ?? [],
      total: r.rental_requests_aggregate?.aggregate?.count ?? 0,
      page,
      limit,
    };
  }

  private buildBusinessRequestsWhere(
    businessId: string,
    status?: string,
    id?: string
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {
      rental_location_listing: {
        rental_item: { business_id: { _eq: businessId } },
      },
    };
    const trimmed = status?.trim();
    const allowed = [
      'pending',
      'available',
      'unavailable',
      'booked',
      'expired',
      'cancelled',
    ];
    if (trimmed && allowed.includes(trimmed)) {
      where.status = { _eq: trimmed };
    }
    const requestId = id?.trim();
    if (requestId) where.id = { _eq: requestId };
    return where;
  }

  private async attachRequestCardFacts(rows: any[], flags: DashboardRequestFlagRow[]): Promise<any[]> {
    const shown = rows.filter((row) => this.rowDashboardOn(flags, row));
    const rails = await this.railsByCountry(shown);
    const held = await this.heldWindowsByListing(shown);
    const ceilings = await this.ceilingsByListing(shown);
    return Promise.all(rows.map((row) => this.withCardFacts(row, flags, rails, held, ceilings)));
  }

  private rowDashboardOn(flags: DashboardRequestFlagRow[], row: any): boolean {
    const country = row.rental_location_listing?.business_location?.address?.country;
    return listingDashboardFlag(flags, country);
  }

  private async railsByCountry(rows: any[]): Promise<Map<string, string | null>> {
    const codes = new Set<string>();
    for (const row of rows) {
      const code = resolveItemCountry(row.rental_location_listing?.business_location?.address?.country);
      if (code) codes.add(code);
    }
    const rails = new Map<string, string | null>();
    for (const code of codes) rails.set(code, await this.paymentRailForCountry(code));
    return rails;
  }

  private async heldWindowsByListing(rows: any[]): Promise<Map<string, Array<{ startMs: number; endMs: number; units: number }>>> {
    const listingIds = [...new Set(rows.map((row) => row.rental_location_listing?.id).filter(Boolean))];
    const grouped = new Map<string, Array<{ startMs: number; endMs: number; units: number }>>();
    if (!listingIds.length) return grouped;
    const loaded = await this.loadHeldWindows(listingIds);
    for (const window of loaded) {
      const id = window.rental_booking?.rental_location_listing_id;
      if (!id) continue;
      const list = grouped.get(id) ?? [];
      list.push(this.heldWindow(window));
      grouped.set(id, list);
    }
    return grouped;
  }

  private heldWindow(window: { start_at: string; end_at: string; rental_booking?: { units_booked?: number | null } | null }) {
    return {
      startMs: new Date(window.start_at).getTime(),
      endMs: new Date(window.end_at).getTime(),
      units: Math.max(1, Number(window.rental_booking?.units_booked) || 1),
    };
  }

  private async loadHeldWindows(listingIds: string[]) {
    const now = new Date().toISOString();
    const r = await this.hasuraSystemService.executeQuery<{
      rental_booking_windows: Array<{
        start_at: string;
        end_at: string;
        rental_booking?: { rental_location_listing_id?: string; units_booked?: number | null } | null;
      }>;
    }>(Q.LIST_HELD_WINDOWS_FOR_LISTINGS, { listingIds, now });
    return r.rental_booking_windows ?? [];
  }

  private async withCardFacts(
    row: any,
    flags: DashboardRequestFlagRow[],
    rails: Map<string, string | null>,
    held: Map<string, Array<{ startMs: number; endMs: number; units: number }>>,
    ceilings: Map<string, number | null>
  ): Promise<any> {
    if (!this.rowDashboardOn(flags, row)) return row;
    const code = resolveItemCountry(row.rental_location_listing?.business_location?.address?.country);
    return {
      ...row,
      payment_rail: code ? rails.get(code) ?? null : null,
      dates_available: await this.datesFromHeld(row, held),
      total_override_ceiling: ceilings.get(this.ceilingKey(row)) ?? null,
    };
  }

  private async ceilingsByListing(rows: any[]): Promise<Map<string, number | null>> {
    const map = new Map<string, number | null>();
    for (const row of rows) {
      const key = this.ceilingKey(row);
      if (!map.has(key)) map.set(key, await this.safeCeiling(row));
    }
    return map;
  }

  private ceilingKey(row: any): string {
    const country = resolveItemCountry(row.rental_location_listing?.business_location?.address?.country) ?? '';
    const currency = String(row.rental_location_listing?.rental_item?.currency ?? '').trim().toUpperCase();
    return `${country}:${currency}`;
  }

  private async safeCeiling(row: any): Promise<number | null> {
    const country = resolveItemCountry(row.rental_location_listing?.business_location?.address?.country);
    try {
      return await this.overrideCeiling(row.rental_location_listing?.rental_item?.currency, country);
    } catch (error: any) {
      return null;
    }
  }

  private async datesFromHeld(
    row: any,
    held: Map<string, Array<{ startMs: number; endMs: number; units: number }>>
  ): Promise<boolean | null> {
    if (row.status !== 'pending') return null;
    if (!row.rental_location_listing?.id) return null;
    try {
      return await this.datesFromSpans(row, held);
    } catch (error: any) {
      return this.datesFromThrown(error);
    }
  }

  private async datesFromSpans(
    row: any,
    held: Map<string, Array<{ startMs: number; endMs: number; units: number }>>
  ): Promise<boolean> {
    const spans = this.requestSpans(row);
    if (!spans) return this.probeCapacity(row);
    const cap = Math.max(1, Number(row.rental_location_listing?.units_available) || 1);
    const want = this.normalizeUnitsRequested(row.units_requested);
    const windows = held.get(row.rental_location_listing.id) ?? [];
    for (const span of spans) {
      const used = this.peakConcurrentUnits(windows, span.start.getTime(), span.end.getTime());
      if (used + want > cap) return false;
    }
    return true;
  }

  private requestSpans(row: any): Array<{ start: Date; end: Date }> | null {
    const raw = row?.rental_selection_windows;
    if (Array.isArray(raw) && raw.length > 0) return this.capacitySpans(row);
    const start = Date.parse(row?.requested_start_at);
    const end = Date.parse(row?.requested_end_at);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return [{ start: new Date(start), end: new Date(end) }];
    }
    return null;
  }

  private async probeCapacity(row: any): Promise<boolean> {
    const listing = row.rental_location_listing;
    const units = Math.max(1, Number(listing?.units_available) || 1);
    await this.assertCapacityForRequestWindows(listing?.id, units, row, this.normalizeUnitsRequested(row.units_requested));
    return true;
  }

  private datesFromThrown(error: any): boolean | null {
    if (error instanceof HttpException && error.getStatus() === HttpStatus.CONFLICT) return false;
    return null;
  }

  private capacitySpans(row: any): Array<{ start: Date; end: Date }> {
    return this.parseRentalSelectionWindows(row).map((window) => {
      if (window.billing === 'all_day' && window.calendarDate) {
        const bounds = this.utcDayBoundsFromCalendarDate(window.calendarDate);
        return { start: bounds.start, end: bounds.end };
      }
      return { start: window.start, end: window.end };
    });
  }

  private async paymentRailForCountry(country: string | null | undefined): Promise<string | null> {
    const code = country?.trim();
    if (!code) return null;
    try {
      return await this.paymentRoutingService.resolveRailForCountry(code);
    } catch {
      return null;
    }
  }

  private withRespondBy(rows: any[], flags: DashboardRequestFlagRow[]): any[] {
    return rows.map((row) => (this.rowDashboardOn(flags, row) ? this.attachRespondBy(row) : row));
  }

  private attachRespondBy(row: any): any {
    const decision = effectiveRespondBy({
      createdAt: row.created_at,
      respondBy: row.respond_by,
      startAt: earliestRequestStartIso(row),
    });
    const country = row.rental_location_listing?.business_location?.address?.country;
    return {
      ...row,
      respond_by: decision.respondBy,
      respond_window: decision.window,
      listing_timezone: marketTimeZone(resolveItemCountry(country) ?? country) ?? 'Africa/Douala',
    };
  }

  private async loadDashboardRequestFlags(): Promise<DashboardRequestFlagRow[]> {
    const rows = await this.hasuraSystemService.executeQuery<{
      application_configurations: DashboardRequestFlagRow[];
    }>(Q.DASHBOARD_REQUESTS_FLAG, {});
    return rows.application_configurations ?? [];
  }

  private async recentNoResponseNotices(businessId: string): Promise<RentalRequestExpiryNotice[]> {
    const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    const where = this.noResponseWhere(businessId, since);
    const r = await this.hasuraSystemService.executeQuery<{ rental_requests: any[] }>(
      Q.LIST_RECENT_NO_RESPONSE_REQUESTS,
      { where }
    );
    return (r.rental_requests ?? []).map((row) => this.toExpiryNotice(row));
  }

  private noResponseWhere(businessId: string, since: string): Record<string, unknown> {
    return {
      status: { _eq: 'unavailable' },
      unavailable_reason_code: { _eq: 'no_response' },
      responded_at: { _gte: since },
      rental_location_listing: { rental_item: { business_id: { _eq: businessId } } },
    };
  }

  private toExpiryNotice(row: any): RentalRequestExpiryNotice {
    const decision = computeRespondBy({
      createdAt: row.created_at,
      startAt: earliestRequestStartIso(row),
    });
    const user = row.client?.user;
    const renterName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
    return {
      id: row.id,
      itemName: row.rental_location_listing?.rental_item?.name ?? 'Rental',
      renterName,
      window: decision.window,
      respondedAt: row.responded_at ?? null,
    };
  }

  /**
   * Releases money held for a booking opened from this request, through
   * releaseFreeCancelFunds (the free-cancel and condition-decline path).
   * Only a booking that never went live is touched; a confirmed or later
   * booking keeps its hold. A still-pending request has no booking, so this
   * is a no-op for it.
   */
  async releaseLinkedDeclineHold(requestId: string): Promise<void> {
    const booking = await this.bookingForRequest(requestId);
    if (!booking || !RELEASABLE_REQUEST_BOOKING_STATUSES.has(String(booking.status))) return;
    await this.releaseFreeCancelFunds(booking);
  }

  private async bookingForRequest(requestId: string): Promise<any | null> {
    const res = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{ id: string }>;
    }>(Q.BOOKING_IDS_FOR_RENTAL_REQUEST, { requestId });
    const id = res.rental_bookings?.[0]?.id;
    return id ? this.fetchBooking(id) : null;
  }

  async getBusinessRentalSchedule(rentalItemId: string): Promise<any[]> {
    const businessId = await this.requireBusinessId();
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings: any[];
    }>(Q.GET_BUSINESS_RENTAL_SCHEDULE, { businessId, rentalItemId });
    return r.rental_bookings ?? [];
  }

  async getBusinessRentalItemActivity(
    itemId: string,
    query: { scope?: string; page?: number; limit?: number } = {}
  ) {
    const businessId = await this.requireBusinessId();
    await this.assertRentalItemForBusiness(itemId, businessId, { allowDeleted: true });
    const scope = normalizeActivityScope(query.scope);
    const page = activityPageLimit(query.page, query.limit);
    const [stats, list] = await Promise.all([
      this.loadItemActivityStats(businessId, itemId),
      this.loadItemActivityBookings(businessId, itemId, scope, page),
    ]);
    return {
      item: stats.item,
      stats: stats.stats,
      suggestedScope: defaultActivityScope(stats.stats),
      scope,
      bookings: list.bookings,
      total: list.total,
      page: page.page,
      limit: page.limit,
    };
  }

  private async loadItemActivityStats(businessId: string, rentalItemId: string) {
    const r = await this.hasuraSystemService.executeQuery<ItemActivityStatsQuery>(
      Q.GET_BUSINESS_RENTAL_ITEM_ACTIVITY_STATS,
      { businessId, rentalItemId }
    );
    return this.mapItemActivityStats(r, rentalItemId);
  }

  private mapItemActivityStats(r: ItemActivityStatsQuery, rentalItemId: string) {
    const completed = r.completed?.aggregate;
    const currency = r.rental_items_by_pk?.currency ?? null;
    return {
      item: {
        id: r.rental_items_by_pk?.id ?? rentalItemId,
        name: r.rental_items_by_pk?.name ?? '',
        currency,
      },
      stats: {
        earnedTotal: earnedFromCompletedSums(
          completed?.sum?.total_amount,
          completed?.sum?.overtime_amount
        ),
        timesRented: completed?.count ?? 0,
        currentlyOut: r.currentlyOut?.aggregate?.count ?? 0,
        upcoming: r.upcoming?.aggregate?.count ?? 0,
        openRequests: r.openRequests?.aggregate?.count ?? 0,
        lastCompletedAt:
          r.lastCompleted?.[0]?.actual_end_at ?? r.lastCompleted?.[0]?.end_at ?? null,
        nextStartAt: r.nextStart?.[0]?.start_at ?? null,
        currency,
      },
    };
  }

  private async loadItemActivityBookings(
    businessId: string,
    rentalItemId: string,
    scope: RentalItemActivityScope,
    page: { limit: number; offset: number }
  ) {
    const statuses = activityStatusesForScope(scope);
    const where: Record<string, unknown> = {
      rental_location_listing: {
        rental_item_id: { _eq: rentalItemId },
        rental_item: { business_id: { _eq: businessId } },
      },
    };
    if (statuses) where.status = { _in: statuses };
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings: any[];
      rental_bookings_aggregate: { aggregate: { count: number } | null } | null;
    }>(Q.GET_BUSINESS_RENTAL_ITEM_ACTIVITY_BOOKINGS, {
      where,
      limit: page.limit,
      offset: page.offset,
      orderBy: activityOrderForScope(scope),
    });
    return {
      bookings: r.rental_bookings ?? [],
      total: r.rental_bookings_aggregate?.aggregate?.count ?? 0,
    };
  }

  async getRequestInspectionPolicy(requestId: string): Promise<number | null> {
    if (!isRequestUuid(requestId)) throw requestPolicyNotFound();
    const user = await this.hasuraUserService.getUser();
    const req = await this.loadRequestQuietly(requestId);
    if (!this.mayReadRequestPolicy(user, req)) throw requestPolicyNotFound();
    const country = req.rental_location_listing?.business_location?.address?.country ?? null;
    if (await this.optInFlag(country)) return req.inspection_policy_version ?? null;
    return this.requestPolicyVersion(req.rental_location_listing);
  }

  private async loadRequestQuietly(id: string): Promise<any | null> {
    try {
      const row = await this.hasuraSystemService.executeQuery<{ rental_requests_by_pk: any }>(
        Q.GET_RENTAL_REQUEST_FULL,
        { id }
      );
      return row.rental_requests_by_pk ?? null;
    } catch (error: any) {
      if (this.hidesMissingRequest(error)) return null;
      throw error;
    }
  }

  private hidesMissingRequest(error: any): boolean {
    if (!(error instanceof HttpException)) return false;
    const status = error.getStatus();
    return status === HttpStatus.BAD_REQUEST || status === HttpStatus.NOT_FOUND;
  }

  private mayReadRequestPolicy(user: any, req: any): boolean {
    if (!req) return false;
    const clientOk = isActivePersona(user, 'client') && user.client?.id === req.client_id;
    const businessId = req.rental_location_listing?.rental_item?.business_id;
    const businessOk = isActivePersona(user, 'business') && user.business?.id === businessId;
    return Boolean(clientOk || businessOk);
  }

  async getClientRentalRequests(): Promise<ClientRentalRequestRow[]> {
    await this.requireClientId();
    const r = await this.hasuraUserService.executeQuery<{
      rental_requests: ClientRentalRequestRow[];
    }>(Q.GET_CLIENT_RENTAL_REQUESTS, {});
    return r.rental_requests ?? [];
  }

  async getClientRentalBookings(): Promise<any[]> {
    await this.requireClientId();
    const r = await this.hasuraUserService.executeQuery<{
      rental_bookings: any[];
    }>(Q.GET_CLIENT_RENTAL_BOOKINGS, {});
    return r.rental_bookings ?? [];
  }

  async getBookingPaymentStatus(bookingId: string) {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException(
        'Only clients can check payment status',
        HttpStatus.FORBIDDEN
      );
    }
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.client_id !== user.client.id) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }
    const bookingNumber = booking.booking_number as string | undefined;
    const momoPending = bookingNumber
      ? await this.mobilePaymentsDatabaseService.hasPendingRentalBookingPayment(
          bookingNumber
        )
      : false;
    const stripePendingTx = bookingNumber
      ? await this.stripePaymentsDatabaseService.getPendingRentalBookingPayment(
          bookingNumber
        )
      : null;
    const stripePending = !!stripePendingTx;
    const paymentPending = momoPending || stripePending;
    let payment_rail: RentalPaymentRail | null = null;
    if (booking.status === 'confirmed' || booking.status === 'active') {
      payment_rail = 'wallet';
    } else if (stripePending) {
      payment_rail = 'stripe';
    } else if (momoPending) {
      payment_rail = 'mobile_money';
    } else if (booking.status === 'proposed') {
      payment_rail = await this.paymentRoutingService.resolveRailForUser(user.id);
    }
    return {
      status: booking.status as string,
      paymentPending,
      payment_rail,
      checkout_url: stripePendingTx?.payment_url ?? null,
      payment_transaction_id: stripePendingTx?.id ?? null,
      has_payment_intent: !!stripePendingTx?.stripe_payment_intent_id,
      contractExpiresAt: (booking.contract_expires_at as string | null) ?? null,
      bookingNumber: bookingNumber ?? null,
    };
  }

  async retryBookingPayment(
    bookingId: string,
    options?: RetryRentalBookingPaymentDto
  ): Promise<RentalBookingActionResult> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException('Only clients can retry payment', HttpStatus.FORBIDDEN);
    }
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.client_id !== user.client.id) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }
    if (booking.status !== 'proposed') {
      throw new HttpException(
        'Payment retry only for proposed bookings',
        HttpStatus.BAD_REQUEST
      );
    }
    const exp = booking.contract_expires_at as string | null | undefined;
    if (!exp || new Date(exp) <= new Date()) {
      throw new HttpException('Contract has expired', HttpStatus.GONE);
    }
    await this.assertAcceptedPriceSeen(booking.rental_request_id as string | undefined);
    const bookingNumber = booking.booking_number as string | undefined;
    if (!bookingNumber) {
      throw new HttpException('Missing booking number', HttpStatus.BAD_REQUEST);
    }
    const snap = booking.rental_pricing_snapshot as RentalPricingSnapshotDto;
    if (!snap || !isValidRentalPricingSnapshot(snap)) {
      throw new HttpException('Invalid pricing on booking', HttpStatus.BAD_REQUEST);
    }
    const total = Number(snap.total);
    const clientAccount = await this.hasuraSystemService.getAccount(
      user.id,
      snap.currency
    );
    const listingCountry = resolveItemCountry(
      booking.rental_location_listing?.business_location?.address?.country
    );
    const rail = listingCountry
      ? await this.paymentRoutingService.resolveRailForCountry(listingCountry)
      : await this.paymentRoutingService.resolveRailForUser(user.id);
    if (rail === 'stripe') {
      const fields = await this.stripeWindowFields(listingCountry, await this.knownInspected(listingCountry, booking));
      this.assertStripeRentalEndWithinAuthWindow(booking.end_at as string, fields);
      await this.assertEnrolledStripeReviewWindow(
        bookingId,
        booking.end_at as string,
        listingCountry
      );
      const deposit =
        Math.max(0, Number(booking.security_deposit_amount) || 0) ||
        this.snapshotSecurityDeposit(snap);
      return this.initiateStripeRentalPayment({
        bookingId,
        bookingNumber,
        amount: Number((total + deposit).toFixed(2)),
        currency: snap.currency,
        clientAccountId: clientAccount.id,
        userId: user.id,
        email: user.email,
        stripePaymentMethod: options?.stripe_payment_method,
      });
    }
    // Legacy pay-now retry for proposed non-Stripe bookings created before
    // reserve-and-pay-at-pickup: wallet if the balance covers, else mobile money.
    const availableBalance = Number(clientAccount?.available_balance ?? 0);
    if (availableBalance >= total) {
      const confirmed = await this.confirmWalletContract({
        booking,
        previousStatus: 'proposed',
        clientUserId: user.id,
        notes: 'Booking confirmed',
      });
      if (!confirmed) {
        throw new HttpException('Booking status changed', HttpStatus.CONFLICT);
      }
      return {
        success: true,
        bookingId,
        payment_rail: 'wallet',
        confirmed: true,
      };
    }
    return this.initiateUnpaidRentalPayment({
      bookingId,
      bookingNumber,
      amount: total,
      currency: snap.currency,
      clientAccountId: clientAccount.id,
      userId: user.id,
      phoneNumber: user.phone_number || '',
      email: user.email,
      itemCountry: listingCountry,
    });
  }

  async cancelClientRentalRequest(requestId: string): Promise<{ success: boolean }> {
    const user = await this.requireCancelClient();
    const req = await this.fetchRequest(requestId);
    this.assertCancelOwner(req, user.clientId);
    const row = await this.cancelRequestRow(requestId, user.clientId);
    if (row.released_booking_id) await this.releaseCancelledBooking(requestId, req);
    return { success: true };
  }

  private async cancelRequestRow(
    requestId: string,
    clientId: string
  ): Promise<{ released_booking_id?: string | null }> {
    try {
      const saved = await this.hasuraSystemService.executeMutation<{
        cancel_client_rental_request: Array<{ id: string }>;
      }>(Q.CANCEL_CLIENT_RENTAL_REQUEST, { requestId, clientId });
      const row = saved.cancel_client_rental_request?.[0];
      if (!row) throw new HttpException('This request cannot be cancelled', HttpStatus.CONFLICT);
      return { released_booking_id: await this.cancelledBookingId(requestId) };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw this.mapEditSqlError(error);
    }
  }

  private async cancelledBookingId(requestId: string): Promise<string | null> {
    const found = await this.hasuraSystemService.executeQuery<{
      rental_bookings: Array<{ id: string }>;
    }>(Q.CANCELLED_BOOKING_FOR_REQUEST, { requestId });
    return found.rental_bookings?.[0]?.id ?? null;
  }

  private async releaseCancelledBooking(requestId: string, request: { id: string }): Promise<void> {
    try {
      await this.releaseLinkedDeclineHold(requestId);
    } catch (error: any) {
      await this.recordSideEffect(requestId, 'release', error, { row: { id: request.id }, window: 'sla' });
    }
  }

  private async requireCancelClient(): Promise<{ userId: string; clientId: string }> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException('Only clients can cancel requests', HttpStatus.FORBIDDEN);
    }
    return { userId: user.id, clientId: user.client.id };
  }

  private assertCancelOwner(req: { client_id?: string }, clientId: string): void {
    if (req.client_id !== clientId) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
  }

  private contractExpiryIso(req: Parameters<typeof earliestRequestStartIso>[0], hours: number, now: Date): string {
    const startIso = earliestRequestStartIso(req);
    const expiry = cappedContractExpiry(startIso, hours, now);
    if (!expiry) {
      throw new HttpException(
        'contractExpiryHours must be a whole number from 1 up to 48, and not past the rental start',
        HttpStatus.BAD_REQUEST
      );
    }
    return expiry;
  }

  async createBusinessRentalItem(dto: CreateBusinessRentalItemDto): Promise<string> {
    const businessId = await this.requireBusinessId();
    const currency =
      await this.hasuraSystemService.resolveBusinessCurrency(businessId);
    const row = await this.hasuraUserService.executeMutation<{
      insert_rental_items_one: { id: string } | null;
    }>(Q.INSERT_BUSINESS_RENTAL_ITEM, {
      object: {
        business_id: businessId,
        rental_category_id: dto.rental_category_id,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        tags: dto.tags ?? [],
        currency,
        operation_mode: dto.operation_mode ?? 'business_operated',
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
    const currency = await this.assertRentalItemForBusiness(dto.rental_item_id, businessId);
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
    const price = Number(dto.base_price_per_hour ?? (dto.offers_hourly === false ? 0 : NaN));
    if (Number.isNaN(price) || price < 0) {
      throw new HttpException('Invalid base_price_per_hour', HttpStatus.BAD_REQUEST);
    }
    const dayPrice = Number(dto.base_price_per_day ?? (dto.offers_daily === false ? 0 : NaN));
    if (Number.isNaN(dayPrice) || dayPrice < 0) {
      throw new HttpException('Invalid base_price_per_day', HttpStatus.BAD_REQUEST);
    }
    const modes = this.createListingModes(dto, price, dayPrice);
    const securityDeposit = this.resolveListingSecurityDeposit(
      dto.security_deposit_amount,
      depositHourRate({ hourPrice: price, dayPrice, offersHourly: dto.offers_hourly }),
      currency
    );
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
        ...modes,
        security_deposit_amount: securityDeposit,
        min_rental_hours: minHours,
        max_rental_hours: maxHours,
        units_available: dto.units_available,
        is_active: true,
        // moderation_status omitted: DB default is draft; business role cannot set it
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

  async publishBusinessRentalListing(listingId: string): Promise<{
    id: string;
    moderation_status: string;
  }> {
    const businessId = await this.requireBusinessId();
    const listing = await this.loadRentalListingBusinessRow(
      listingId,
      businessId
    );
    if (listing.moderation_status !== 'draft') {
      throw new HttpException(
        'Only draft listings can be published',
        HttpStatus.BAD_REQUEST
      );
    }
    const result = await this.hasuraSystemService.executeMutation<{
      update_rental_location_listings: {
        affected_rows: number;
        returning: Array<{ id: string; moderation_status: string }>;
      };
    }>(Q.PUBLISH_RENTAL_LISTING_FROM_DRAFT, { id: listingId });
    const row = result.update_rental_location_listings?.returning?.[0];
    if (!row || result.update_rental_location_listings.affected_rows < 1) {
      throw new HttpException(
        'Failed to publish listing',
        HttpStatus.BAD_REQUEST
      );
    }
    void this.rentalListingAiReviewService.requestReview(listingId);
    return row;
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
    const item = await this.attachListingRejectionReasons(r.rental_items_by_pk);
    item.inspection = await this.inspectionOptIn.summaryIfEnabled(itemId);
    return item;
  }

  async updateBusinessRentalItem(
    itemId: string,
    dto: UpdateBusinessRentalItemDto
  ): Promise<void> {
    const businessId = await this.requireBusinessId();
    await this.assertRentalItemForBusiness(itemId, businessId);
    const changes = this.buildRentalItemUpdateSet(dto);
    if (dto.currency !== undefined || changes.currency !== undefined) {
      changes.currency =
        await this.hasuraSystemService.resolveBusinessCurrency(businessId);
    }
    if (!Object.keys(changes).length) {
      return;
    }
    if (changes.is_active === true) {
      await this.activationValidation.assertRentalItemCanActivate(itemId);
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
      await this.assertListingModesAfterPatch(listingId, changes);
      if (changes.units_available !== undefined) {
        await this.assertUnitsAvailableNotBelowCommitted(
          listingId,
          Number(changes.units_available)
        );
      }
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
    if (dto.operation_mode !== undefined) {
      out.operation_mode = dto.operation_mode;
    }
    if (dto.is_active !== undefined) {
      out.is_active = dto.is_active;
    }
    return out;
  }

  /**
   * Rent by the day / Rent by the hour. Old clients send neither switch, so the
   * columns keep their DB default (both on) and prices are checked as before.
   */
  private createListingModes(
    dto: CreateBusinessRentalListingDto,
    hourPrice: number,
    dayPrice: number
  ): { offers_hourly?: boolean; offers_daily?: boolean } {
    if (dto.offers_hourly === undefined && dto.offers_daily === undefined) return {};
    const offersHourly = dto.offers_hourly !== false;
    const offersDaily = dto.offers_daily !== false;
    this.throwDayHours(
      listingModesViolation({ offersHourly, offersDaily, hourPrice, dayPrice })
    );
    return { offers_hourly: offersHourly, offers_daily: offersDaily };
  }

  /** Same rule after a patch: at least one switch on, and a price for each one on. */
  private async assertListingModesAfterPatch(
    listingId: string,
    set: Record<string, unknown>
  ): Promise<void> {
    if (set.offers_hourly === undefined && set.offers_daily === undefined) return;
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings_by_pk: {
        offers_hourly: boolean | null;
        offers_daily: boolean | null;
        base_price_per_hour: number | string | null;
        base_price_per_day: number | string | null;
      } | null;
    }>(Q.GET_RENTAL_LISTING_MODES, { id: listingId });
    const cur = r.rental_location_listings_by_pk;
    if (!cur) return;
    const pick = <T>(key: string, fallback: T): T =>
      set[key] === undefined ? fallback : (set[key] as T);
    this.throwDayHours(
      listingModesViolation({
        offersHourly: pick('offers_hourly', cur.offers_hourly !== false),
        offersDaily: pick('offers_daily', cur.offers_daily !== false),
        hourPrice: Number(pick('base_price_per_hour', cur.base_price_per_hour)) || 0,
        dayPrice: Number(pick('base_price_per_day', cur.base_price_per_day)) || 0,
      })
    );
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
    if (dto.security_deposit_amount !== undefined) {
      out.security_deposit_amount = this.resolveListingSecurityDeposit(
        dto.security_deposit_amount,
        0
      );
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
    if (dto.offers_hourly !== undefined) {
      out.offers_hourly = dto.offers_hourly;
    }
    if (dto.offers_daily !== undefined) {
      out.offers_daily = dto.offers_daily;
    }
    return out;
  }

  /** Explicit deposit when provided. Card listings default to 8x depositHourRate. XAF and XOF stay 0. */
  private resolveListingSecurityDeposit(
    raw: number | undefined,
    hourlyRate: number,
    currency?: string | null
  ): number {
    if (raw !== undefined) return this.explicitDeposit(raw);
    if (!cardDepositCurrency(currency)) return 0;
    return Number((hourlyRate * RENTAL_SECURITY_DEPOSIT_HOURLY_MULTIPLIER).toFixed(2));
  }

  private explicitDeposit(raw: number): number {
    const value = Number(raw);
    if (Number.isNaN(value) || value < 0) {
      throw new HttpException('Invalid security_deposit_amount', HttpStatus.BAD_REQUEST);
    }
    return Number(value.toFixed(2));
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
    void this.rentalListingAiReviewService.requestReview(listingId);
  }

  private async requireBusinessId(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException(
        { success: false, error: 'Business profile required' },
        HttpStatus.FORBIDDEN
      );
    }
    return user.business.id;
  }

  private async requireClientId(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException(
        { success: false, error: 'Client profile required' },
        HttpStatus.FORBIDDEN
      );
    }
    return user.client.id;
  }

  private async attachListingRejectionReasons(item: any): Promise<any> {
    const listings = item.rental_location_listings ?? [];
    const rejectedIds = listings
      .filter((l: { moderation_status?: string }) => l.moderation_status === 'rejected')
      .map((l: { id: string }) => l.id);
    const reasons = await resolveRentalListingRejectionReasons(
      this.hasuraSystemService,
      rejectedIds
    );
    const withReasons = listings.map((l: { id: string; moderation_status?: string }) =>
      this.withListingRejectionReason(l, reasons)
    );
    return { ...item, rental_location_listings: withReasons };
  }

  private withListingRejectionReason(
    listing: { id: string; moderation_status?: string },
    reasons: Map<string, string>
  ) {
    const rejection_reason =
      listing.moderation_status === 'rejected'
        ? reasons.get(listing.id) ?? null
        : null;
    return { ...listing, rejection_reason };
  }

  private async assertRentalItemForBusiness(
    itemId: string,
    businessId: string,
    options: { allowDeleted?: boolean } = {}
  ): Promise<string> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_items_by_pk: {
        business_id: string;
        currency?: string | null;
        deleted_at: string | null;
      } | null;
    }>(Q.GET_RENTAL_ITEM_BUSINESS_CHECK, { id: itemId });
    const row = r.rental_items_by_pk;
    if (!row || row.business_id !== businessId) {
      throw new HttpException('Rental item not found', HttpStatus.NOT_FOUND);
    }
    if (!options.allowDeleted && row.deleted_at) {
      throw new HttpException('This rental item was removed', HttpStatus.BAD_REQUEST);
    }
    return row.currency ?? '';
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
    if (!isActivePersona(user, 'client') || !user.client?.id) {
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
        user.email,
        dto.stripe_payment_method
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
      user.email,
      dto.stripe_payment_method
    );
  }

  private async confirmProposedRentalBooking(
    requestId: string,
    req: any,
    userId: string,
    clientId: string,
    phoneNumber: string,
    email: string | null | undefined,
    stripePaymentMethod?: 'payment_sheet'
  ): Promise<RentalBookingActionResult> {
    const bookingId = req.rental_booking?.id as string;
    const bookingNumber = req.rental_booking?.booking_number as string | undefined;
    const exp = req.rental_booking?.contract_expires_at as string | null | undefined;
    if (!exp || new Date(exp) <= new Date()) {
      throw new HttpException('Contract has expired', HttpStatus.GONE);
    }
    this.assertPriceChangeSeen(req);
    // Exclude this proposed booking — its windows already hold capacity.
    await this.assertCapacityForRequestWindows(
      req.rental_location_listing_id,
      req.rental_location_listing.units_available,
      req,
      this.normalizeUnitsRequested(req.units_requested),
      bookingId
    );
    if (!bookingNumber) {
      throw new HttpException('Missing booking_number for this rental booking', HttpStatus.BAD_REQUEST);
    }
    return this.acceptProposedBookingByRail({
      bookingId,
      bookingNumber,
      requestId,
      req,
      userId,
      email,
      stripePaymentMethod,
    });
  }

  /**
   * Rail-specific acceptance of a proposed contract:
   * - Stripe: authorize contract + security deposit now (manual capture);
   *   booking confirms on the `authorized` webhook.
   * - Wallet / mobile money: reserve without paying; contract is collected at pickup.
   */
  private async acceptProposedBookingByRail(params: {
    bookingId: string;
    bookingNumber: string;
    requestId: string;
    req: any;
    userId: string;
    email?: string | null;
    stripePaymentMethod?: 'payment_sheet';
  }): Promise<RentalBookingActionResult> {
    const snap = params.req.rental_pricing_snapshot as RentalPricingSnapshotDto;
    const listingCountry = resolveItemCountry(
      params.req.rental_location_listing?.business_location?.address?.country
    );
    const rail = listingCountry
      ? await this.paymentRoutingService.resolveRailForCountry(listingCountry)
      : await this.paymentRoutingService.resolveRailForUser(params.userId);
    if (rail !== 'stripe') {
      return this.reserveRentalBookingForPickup(
        params.bookingId,
        params.requestId,
        params.userId
      );
    }
    const enrolledEnd = this.requestWindowEnvelope(params.req).endAt;
    const fields = await this.stripeWindowFields(listingCountry, await this.knownInspected(listingCountry, params.req));
    this.assertStripeRentalEndWithinAuthWindow(enrolledEnd, fields);
    await this.assertEnrolledStripeReviewWindow(params.bookingId, enrolledEnd, listingCountry);
    const total = Number(snap.total);
    const deposit = this.snapshotSecurityDeposit(snap);
    const clientAccount = await this.hasuraSystemService.getAccount(
      params.userId,
      snap.currency
    );
    return this.initiateStripeRentalPayment({
      bookingId: params.bookingId,
      bookingNumber: params.bookingNumber,
      amount: Number((total + deposit).toFixed(2)),
      currency: snap.currency,
      clientAccountId: clientAccount.id,
      userId: params.userId,
      email: params.email,
      stripePaymentMethod: params.stripePaymentMethod,
    });
  }

  /** Wallet / mobile money: hold capacity without payment; pay at pickup. */
  private async reserveRentalBookingForPickup(
    bookingId: string,
    requestId: string,
    userId: string
  ): Promise<RentalBookingActionResult> {
    const won = await this.casBooking(bookingId, ['proposed'], {
      status: 'reserved',
      contract_expires_at: null,
      payment_timing: 'pay_at_pickup',
      payment_status: 'pending',
    });
    if (!won) return this.reserveReplayResult(bookingId);
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_STATUS, {
      id: requestId,
      status: 'booked',
    });
    await this.logHistory(
      bookingId,
      'reserved',
      'proposed',
      userId,
      'client',
      'Reserved without payment - contract due at pickup'
    );
    await this.notifyRentalBookingReserved(bookingId);
    return {
      success: true,
      bookingId,
      payment_rail: 'mobile_money',
      reserved: true,
    };
  }

  private async notifyRentalBookingReserved(bookingId: string): Promise<void> {
    try {
      const booking = await this.fetchBooking(bookingId);
      await this.notificationsService.sendRentalBookingReservedPush({
        clientUserId: booking?.client?.user_id,
        businessUserId: booking?.business?.user_id,
        rentalItemName:
          booking?.rental_location_listing?.rental_item?.name ?? 'Rental',
        bookingId,
        bookingNumber: booking?.booking_number ?? '',
        inspected: booking?.inspection_policy_version != null,
      });
    } catch (error: any) {
      this.logger.warn(
        `notifyRentalBookingReserved: ${error?.message ?? String(error)}`
      );
    }
  }

  /** Stripe rail: the booking must end before the card authorization could expire. */
  private assertStripeRentalEndWithinAuthWindow(endAtIso: string, fields?: ListingCardWindow): void {
    if (fields?.mode === 'charge_at_pickup') return;
    const limit = Date.now() + STRIPE_AUTH_WINDOW_DAYS * 86400000;
    if (new Date(endAtIso).getTime() <= limit) return;
    throw cardWindowRejected(
      'RENTAL_STRIPE_BOOKING_WINDOW_EXCEEDED',
      `Card payments support rentals ending within ${STRIPE_AUTH_WINDOW_DAYS} days`,
      fields ?? emptyStripeFields()
    );
  }

  private async createLegacyRentalBooking(
    requestId: string,
    req: any,
    userId: string,
    clientId: string,
    phoneNumber: string,
    email: string | null | undefined,
    stripePaymentMethod?: 'payment_sheet'
  ): Promise<RentalBookingActionResult> {
    this.assertPriceChangeSeen(req);
    await this.assertCapacityForRequestWindows(
      req.rental_location_listing_id,
      req.rental_location_listing.units_available,
      req,
      this.normalizeUnitsRequested(req.units_requested)
    );
    const snap = req.rental_pricing_snapshot as RentalPricingSnapshotDto;
    const total = Number(snap.total);
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
    try {
      return await this.acceptProposedBookingByRail({
        bookingId,
        bookingNumber,
        requestId,
        req,
        userId,
        email,
        stripePaymentMethod,
      });
    } catch (e: any) {
      await this.deleteBooking(bookingId);
      throw e;
    }
  }

  /**
   * Mobile-money push for an unpaid proposed booking (legacy pay-now retry path).
   */
  private async initiateUnpaidRentalPayment(params: {
    bookingId: string;
    bookingNumber: string;
    amount: number;
    currency: string;
    clientAccountId: string;
    userId: string;
    phoneNumber: string;
    email?: string | null;
    itemCountry?: string | null;
  }): Promise<RentalBookingActionResult> {
    const momoPending =
      await this.mobilePaymentsDatabaseService.hasPendingRentalBookingPayment(
        params.bookingNumber
      );
    if (momoPending) {
      return {
        success: true,
        bookingId: params.bookingId,
        payment_rail: 'mobile_money',
        paymentPending: true,
      };
    }
    await this.initiateRentalBookingPayment({
      bookingNumber: params.bookingNumber,
      amount: params.amount,
      currency: params.currency,
      clientAccountId: params.clientAccountId,
      userId: params.userId,
      phoneNumber: params.phoneNumber,
      email: params.email,
      purpose: 'contract',
      paymentEntity: 'rental_booking',
      itemCountry: params.itemCountry,
    });
    return {
      success: true,
      bookingId: params.bookingId,
      payment_rail: 'mobile_money',
      paymentPending: true,
    };
  }

  private async initiateStripeRentalPayment(params: {
    bookingId: string;
    bookingNumber: string;
    amount: number;
    currency: string;
    clientAccountId: string;
    userId: string;
    email?: string | null;
    stripePaymentMethod?: 'payment_sheet';
  }): Promise<RentalBookingActionResult> {
    const useSheet = params.stripePaymentMethod === 'payment_sheet';
    const existing =
      await this.stripePaymentsDatabaseService.getPendingRentalBookingPayment(
        params.bookingNumber
      );
    if (useSheet) {
      const reused = await this.reusePendingRentalPaymentIntent(
        params.bookingId,
        existing
      );
      if (reused) return reused;
      return this.createRentalPaymentIntent(params);
    }
    if (existing?.payment_url) {
      return {
        success: true,
        bookingId: params.bookingId,
        payment_rail: 'stripe',
        checkout_url: existing.payment_url,
        payment_transaction_id: existing.id,
        paymentPending: true,
      };
    }
    return this.createRentalCheckoutSession(params);
  }

  private async reusePendingRentalPaymentIntent(
    bookingId: string,
    existing: { id: string; stripe_payment_intent_id?: string } | null
  ): Promise<RentalBookingActionResult | null> {
    if (!existing?.stripe_payment_intent_id) return null;
    try {
      const pi = await this.stripeService.retrievePaymentIntent(
        existing.stripe_payment_intent_id
      );
      if (!pi.client_secret) return null;
      return {
        success: true,
        bookingId,
        payment_rail: 'stripe',
        payment_intent_client_secret: pi.client_secret,
        payment_transaction_id: existing.id,
        paymentPending: true,
      };
    } catch (error: any) {
      this.logger.warn(
        `reusePendingRentalPaymentIntent: ${error?.message ?? String(error)}`
      );
      return null;
    }
  }

  private async createRentalPaymentIntent(params: {
    bookingId: string;
    bookingNumber: string;
    amount: number;
    currency: string;
    clientAccountId: string;
    email?: string | null;
  }): Promise<RentalBookingActionResult> {
    const intent = await this.stripeCheckoutService.createPaymentIntent({
      amount: params.amount,
      currency: params.currency,
      description: `Rental booking ${params.bookingNumber}`,
      accountId: params.clientAccountId,
      paymentEntity: 'rental_booking',
      entityId: params.bookingNumber,
      bookingId: params.bookingId,
      customerEmail: params.email ?? undefined,
      captureMethod: 'manual',
    });
    if (!intent.clientSecret) {
      throw new HttpException(
        'Failed to create Stripe PaymentIntent',
        HttpStatus.BAD_GATEWAY
      );
    }
    return {
      success: true,
      bookingId: params.bookingId,
      payment_rail: 'stripe',
      payment_intent_client_secret: intent.clientSecret,
      payment_transaction_id: intent.transactionId,
      paymentPending: true,
    };
  }

  private async createRentalCheckoutSession(params: {
    bookingId: string;
    bookingNumber: string;
    amount: number;
    currency: string;
    clientAccountId: string;
    email?: string | null;
  }): Promise<RentalBookingActionResult> {
    const checkout = await this.stripeCheckoutService.createCheckout({
      amount: params.amount,
      currency: params.currency,
      description: `Rental booking ${params.bookingNumber}`,
      accountId: params.clientAccountId,
      paymentEntity: 'rental_booking',
      entityId: params.bookingNumber,
      bookingId: params.bookingId,
      customerEmail: params.email ?? undefined,
      captureMethod: 'manual',
    });
    if (!checkout.paymentUrl) {
      throw new HttpException(
        'Failed to create Stripe checkout session',
        HttpStatus.BAD_GATEWAY
      );
    }
    return {
      success: true,
      bookingId: params.bookingId,
      payment_rail: 'stripe',
      checkout_url: checkout.paymentUrl,
      payment_transaction_id: checkout.transactionId,
      paymentPending: true,
    };
  }

  private async finalizeRentalBookingConfirmation(
    bookingId: string,
    requestId: string,
    clientUserId: string,
    previousStatus: string | null = 'proposed',
    notes = 'Booking confirmed'
  ): Promise<boolean> {
    const from = previousStatus ?? 'proposed';
    const won = await this.casBooking(bookingId, [from], {
      status: 'confirmed',
      contract_expires_at: null,
    });
    if (!won) return false;
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_REQUEST_STATUS, {
      id: requestId,
      status: 'booked',
    });
    const policy = await this.readInspectionPolicy(bookingId);
    await this.logHistory(bookingId, 'confirmed', previousStatus, clientUserId, 'client', notes);
    try {
      const booking = await this.fetchBooking(bookingId);
      const itemName =
        booking?.rental_location_listing?.rental_item?.name ?? 'Rental';
      const bookingNumber = booking?.booking_number ?? '';
      await this.notificationsService.sendRentalBookingConfirmedPush({
        clientUserId,
        rentalItemName: itemName,
        bookingId,
        bookingNumber,
        inspected: policy != null,
      });
    } catch (error: any) {
      this.logger.warn(
        `finalizeRentalBookingConfirmation push: ${error?.message ?? String(error)}`
      );
    }
    return true;
  }

  private async initiateRentalBookingPayment(params: {
    bookingNumber: string;
    amount: number;
    currency: string;
    clientAccountId: string;
    userId: string;
    phoneNumber: string;
    email?: string | null;
    purpose: 'contract' | 'overtime';
    paymentEntity: 'rental_booking';
    itemCountry?: string | null;
  }): Promise<void> {
    if (!params.phoneNumber.trim()) {
      throw new HttpException(
        'Phone number is required for payment',
        HttpStatus.BAD_REQUEST
      );
    }

    const provider = params.itemCountry
      ? await this.mobilePaymentsService.getProviderForCountry(params.itemCountry)
      : this.mobilePaymentsService.getProvider(params.phoneNumber);

    const isMyPVitLike = provider === 'mypvit';
    const reference = newRentalMomoReference(params.purpose);
    const providerReference = isMyPVitLike
      ? reference.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)
      : reference;
    const descriptionShort = isMyPVitLike
      ? providerReference
      : `rental booking ${params.bookingNumber}`;

    const opened = await this.openRentalMomoTransaction({
      reference: providerReference,
      amount: params.amount,
      currency: params.currency,
      description: descriptionShort,
      provider: await provider,
      payment_method: 'mobile_money',
      customer_phone: params.phoneNumber,
      ...(params.email ? { customer_email: params.email } : {}),
      account_id: params.clientAccountId,
      transaction_type: 'PAYMENT',
      payment_entity: params.paymentEntity,
      entity_id: params.bookingNumber,
      idempotency_key: rentalMomoIdempotencyKey(
        params.bookingNumber,
        params.purpose
      ),
    });
    if (!opened.send) return;
    const transaction = opened.tx;

    const paymentRequest: MobilePaymentRequest = {
      amount: params.amount,
      currency: params.currency,
      description: descriptionShort,
      customerPhone: params.phoneNumber,
      provider: await provider,
      itemCountry: params.itemCountry ?? undefined,
      ownerCharge: 'CUSTOMER' as const,
      transactionType: 'PAYMENT' as const,
    };

    const paymentResponse = await this.mobilePaymentsService.initiatePayment(
      paymentRequest,
      transaction.reference || providerReference,
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
      // G2: Schedule mock callback AFTER persisting transaction_id
      if (paymentResponse.transactionId.startsWith('mock-')) {
        await this.mobilePaymentsService.scheduleMockCallback(
          paymentResponse.transactionId,
          providerReference
        );
      }
    }
  }

  private async fetchBookingByBookingNumber(bookingNumber: string): Promise<any | null> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings: any[];
    }>(Q.GET_RENTAL_BOOKING_FULL_BY_BOOKING_NUMBER, { bookingNumber });

    return r.rental_bookings?.[0] ?? null;
  }

  /**
   * Called from payment webhooks after the client account is credited.
   * Confirms unpaid `proposed`/`reserved` bookings (hold + PIN) and settles
   * pending overtime on `awaiting_return` bookings.
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
    if (await refundLateCollectIfDeclined(booking)) return;
    if (booking.status === 'proposed' || booking.status === 'reserved') {
      await this.confirmBookingAfterContractPayment(booking, bookingNumber);
      return;
    }
    if (this.confirmedWalletNeedsHold(booking)) {
      await this.finishConfirmedWalletHold(
        booking,
        this.walletHoldPreviousStatus(booking)
      );
      return;
    }
    if (
      (booking.status === 'active' || booking.status === 'awaiting_return') &&
      Number(booking.overtime_amount) > 0
    ) {
      const policy = await this.readInspectionPolicy(booking.id);
      if (policy != null) {
        await this.settleEnrolledRental(booking.id);
        return;
      }
    }
    if (
      booking.status === 'awaiting_return' &&
      Number(booking.overtime_amount) > 0
    ) {
      await this.finalizeRentalOvertimeAfterPayment(booking);
      return;
    }
    // Idempotency: already confirmed / cancelled / completed.
  }

  /** A collect approved after the decline. Queue the refund, or alert if it is not one. */
  async recoverDeclinedLateCollect(transaction: {
    entity_id?: string | null;
    reference?: string | null;
    amount?: number | string | null;
    currency?: string | null;
    provider?: string | null;
    customer_phone?: string | null;
    transaction_id?: string | null;
  }): Promise<boolean> {
    const bookingNumber = transaction.entity_id || transaction.reference;
    if (!bookingNumber) return false;
    const booking = await this.fetchBookingByBookingNumber(bookingNumber);
    if (!booking?.condition_declined_at || !booking.id) {
      this.alertUnmatchedLateCollect(String(bookingNumber));
      return false;
    }
    await refundLateCollectIfDeclined(booking, this.lateCollectPayment(transaction));
    return true;
  }

  private alertUnmatchedLateCollect(bookingNumber: string): void {
    reportMoneyAnomaly(
      this.logger,
      'late_rental_collect',
      `Late Mobile Money collect for ${bookingNumber} is not a declined rental`,
      { bookingNumber }
    );
  }

  private lateCollectPayment(transaction: {
    amount?: number | string | null;
    currency?: string | null;
    provider?: string | null;
    customer_phone?: string | null;
    transaction_id?: string | null;
  }): CollectedPayment {
    return {
      amount: Number(transaction.amount ?? 0),
      currency: String(transaction.currency ?? ''),
      provider: String(transaction.provider ?? ''),
      phone: transaction.customer_phone ?? null,
      transactionId: transaction.transaction_id ?? null,
    };
  }

  /** Wallet credit landed: confirm + PIN, then hold the contract and mark paid. */
  private async confirmBookingAfterContractPayment(
    booking: any,
    bookingNumber: string
  ): Promise<void> {
    const clientUserId = booking.client?.user_id as string | undefined;
    if (!clientUserId) {
      this.logger.warn(
        `processRentalBookingPayment: missing booking client user_id for ${bookingNumber}`
      );
      return;
    }
    const previous = this.walletHoldPreviousStatus(booking);
    await this.confirmWalletContract({
      booking,
      previousStatus: previous,
      clientUserId,
      notes:
        previous === 'reserved'
          ? 'Contract paid at pickup'
          : 'Booking confirmed',
    });
    await this.startEnrolledAfterPickupPayment(booking);
  }

  /**
   * Claim confirmed before the wallet hold. A lost claim releases any hold
   * already taken. Payment is stamped paid only while the booking is still
   * confirmed or active; a cancel in that gap releases the hold instead.
   * A hold or paid-stamp failure puts the booking back so payment can retry.
   */
  private async confirmWalletContract(params: {
    booking: any;
    previousStatus: 'proposed' | 'reserved';
    clientUserId: string;
    notes: string;
  }): Promise<boolean> {
    await this.finalizeRentalBookingConfirmation(
      params.booking.id,
      params.booking.rental_request_id,
      params.clientUserId,
      params.previousStatus,
      params.notes
    );
    const fresh = await this.fetchBooking(params.booking.id);
    if (fresh?.status !== 'confirmed' && fresh?.status !== 'active') {
      await this.releaseHoldIfNeeded(params.booking.id, fresh ?? params.booking);
      return false;
    }
    return this.finishConfirmedWalletHold(params.booking, params.previousStatus);
  }

  private confirmedWalletNeedsHold(booking: any): boolean {
    return (
      booking.status === 'confirmed' &&
      booking.payment_status !== 'paid' &&
      booking.payment_status !== 'authorized'
    );
  }

  private walletHoldPreviousStatus(booking: any): 'proposed' | 'reserved' {
    if (booking.status === 'reserved' || booking.payment_timing === 'pay_at_pickup') {
      return 'reserved';
    }
    return 'proposed';
  }

  /**
   * Place the contract hold, then mark paid only if the booking is still
   * confirmed or active. A cancel that won in between releases that hold on
   * the same ledger key and does not leave payment_status paid.
   */
  private async finishConfirmedWalletHold(
    booking: any,
    previousStatus: 'proposed' | 'reserved'
  ): Promise<boolean> {
    const owned = { value: false };
    try {
      await this.claimWalletHold(booking, owned);
      return await this.payHoldOrRelease(booking);
    } catch (error) {
      if (owned.value) {
        await this.revertUnpaidConfirmation(booking, previousStatus);
      }
      throw error;
    }
  }

  private async claimWalletHold(
    booking: any,
    owned: { value: boolean }
  ): Promise<void> {
    const hold = await this.getHold(booking.id);
    if (hold?.status === 'active') return;
    owned.value = true;
    const placed = await this.placeHoldForBooking(
      booking.id,
      booking.client_id,
      Number(booking.total_amount),
      booking.currency
    );
    owned.value = placed === 'own';
  }

  private async payHoldOrRelease(booking: any): Promise<boolean> {
    const paid = await this.casBooking(booking.id, ['confirmed', 'active'], {
      payment_status: 'paid',
    });
    if (paid) return true;
    await this.releaseHoldIfNeeded(booking.id, booking);
    return false;
  }

  private async revertUnpaidConfirmation(
    booking: any,
    previousStatus: 'proposed' | 'reserved'
  ): Promise<void> {
    try {
      const fresh = await this.fetchBooking(booking.id);
      const source = fresh?.client ? fresh : booking;
      if (fresh?.status === 'active') return;
      await this.releaseHoldIfNeeded(booking.id, source);
      if (fresh?.status !== 'confirmed') return;
      await this.casBooking(booking.id, ['confirmed'], {
        status: previousStatus,
        payment_status: booking.payment_status ?? 'pending',
        contract_expires_at: booking.contract_expires_at ?? null,
        rental_start_pin_hash: null,
        rental_start_pin_attempts: 0,
      });
      await this.deliveryPinService.clearPinForOrder(booking.id);
    } catch (error: any) {
      this.logger.error(
        `revertUnpaidConfirmation ${booking.id}: ${error?.message ?? error}`
      );
    }
  }

  /**
   * Called from Stripe webhooks when a manual-capture authorization succeeds:
   * confirm the booking without moving wallet funds (capture happens at return).
   */
  async processRentalBookingAuthorization(transaction: any): Promise<void> {
    const booking = await this.bookingAwaitingCardAuth(transaction);
    if (!booking) return;
    const stamped = await this.stampCardAuthorized(
      booking,
      Number(transaction.amount)
    );
    if (!stamped) {
      await this.voidCardAuthIfCancelled(booking);
      return;
    }
    const confirmed = await this.finalizeRentalBookingConfirmation(
      booking.id,
      booking.rental_request_id,
      booking.client.user_id as string,
      'proposed',
      'Card authorized (contract + deposit)'
    );
    if (!confirmed) await this.voidCardAuthIfCancelled(booking);
  }

  private async bookingAwaitingCardAuth(transaction: any): Promise<any | null> {
    const bookingNumber = transaction?.entity_id || transaction?.reference;
    if (!bookingNumber) {
      this.logger.warn('processRentalBookingAuthorization: missing bookingNumber');
      return null;
    }
    const booking = await this.fetchBookingByBookingNumber(bookingNumber);
    if (!booking || booking.status !== 'proposed') return null;
    if (!booking.client?.user_id) {
      this.logger.warn(
        `processRentalBookingAuthorization: missing client user_id for ${bookingNumber}`
      );
      return null;
    }
    return booking;
  }

  private async stampCardAuthorized(booking: any, amount: number): Promise<boolean> {
    return this.casBooking(booking.id, ['proposed'], {
      payment_status: 'authorized',
      authorized_amount: amount,
      payment_timing: 'pay_now',
    });
  }

  private async voidCardAuthIfCancelled(booking: any): Promise<void> {
    const fresh = await this.fetchBooking(booking.id);
    if (fresh?.status !== 'cancelled') return;
    await this.cancelStripeAuthorizationIfAny(fresh);
  }

  /**
   * Free cancellation before the rental starts, for client or business:
   * releases the wallet hold, cancels any Stripe authorization, and frees
   * the reserved capacity. Not available once the rental is active.
   */
  async cancelRentalBooking(bookingId: string) {
    const user = await this.hasuraUserService.getUser();
    const booking = await this.fetchBooking(bookingId);
    if (!booking) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }
    const isClient =
      isActivePersona(user, 'client') && user.client?.id === booking.client_id;
    const isBusiness =
      isActivePersona(user, 'business') &&
      user.business?.id === booking.business_id;
    if (!isClient && !isBusiness) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    const cancellable =
      (booking.status === 'confirmed' || booking.status === 'reserved') &&
      !booking.actual_start_at;
    if (!cancellable) {
      throw new HttpException(
        'Only reserved or confirmed bookings can be cancelled before the rental starts',
        HttpStatus.BAD_REQUEST
      );
    }
    const from = booking.status as string;
    const won = await this.casBooking(bookingId, [from], {
      status: 'cancelled',
      payment_status: 'cancelled',
      contract_expires_at: null,
    });
    if (!won) return this.alreadyCancelledOrConflict(bookingId);
    try {
      // A hold placed after this read is released by the paid-stamp compare-and-set.
      await this.releaseHoldIfNeeded(bookingId, booking);
      await this.cancelStripeAuthorizationIfAny(booking);
    } catch (error) {
      await this.casBooking(bookingId, ['cancelled'], {
        status: from,
        payment_status: booking.payment_status,
        contract_expires_at: booking.contract_expires_at,
      });
      throw error;
    }
    const cancelledBy: 'client' | 'business' = isClient ? 'client' : 'business';
    await this.logHistory(
      bookingId,
      'cancelled',
      booking.status,
      user.id,
      cancelledBy,
      'Cancelled before start (no charge)'
    );
    await this.deliveryPinService.clearPinForOrder(bookingId);
    await this.notifyRentalBookingCancelled(booking, cancelledBy);
    return { success: true };
  }

  /**
   * Void a pending/authorized Stripe payment for this booking (no-op
   * otherwise). Throws on a real void failure so callers do not mark the
   * booking cancelled while a card hold is still outstanding.
   */
  /** Wallet hold release and Stripe void used by a free cancel and a condition decline. */
  async releaseFreeCancelFunds(booking: {
    id: string;
    booking_number?: string | null;
    currency: string;
    client: { user_id: string };
  }): Promise<void> {
    await this.cancelStripeAuthorizationIfAny(booking);
    await this.releaseHoldIfNeeded(booking.id, booking);
  }

  /**
   * MoMo decline. The collect already credited the wallet and placed a hold.
   * Release that hold and debit the payout in the same booking key so the
   * phone transfer is the only money that leaves.
   */
  async consumeDeclineHold(
    booking: { id: string; currency: string; client: { user_id: string } },
    amount: number
  ): Promise<void> {
    if (!(amount > 0)) return;
    if (await this.declineRefundDebited(booking.id)) {
      await this.settleDeclineHold(booking);
      return;
    }
    await this.settleDeclineHold(booking);
    await this.debitDeclineRefund(booking, amount);
  }

  /** The decline:refund key already on the ledger. A second debit is success, not a revert. */
  async declineRefundDebited(bookingId: string): Promise<boolean> {
    const key = rentalLedgerKey(bookingId, 'decline:refund');
    const result = await this.hasuraSystemService.executeQuery<{
      account_transactions?: Array<{ id: string }>;
    }>(DECLINE_REFUND_DEBIT, { key });
    return (result.account_transactions?.length ?? 0) > 0;
  }

  private async settleDeclineHold(booking: { id: string; currency: string; client: { user_id: string } }): Promise<void> {
    const hold = await this.getHold(booking.id);
    if (hold?.status !== 'active') return;
    try {
      await this.releaseDeclineHold(booking, hold);
    } catch (error: any) {
      if (await this.declineHoldSettled(booking.id)) return;
      throw error;
    }
  }

  private async declineHoldSettled(bookingId: string): Promise<boolean> {
    const hold = await this.getHold(bookingId);
    if (!hold || hold.status !== 'active') return true;
    return this.declineRefundDebited(bookingId);
  }

  private async releaseDeclineHold(
    booking: { id: string; currency: string; client: { user_id: string } },
    hold: { client_hold_amount: number; ledger_attempt_id?: string | null }
  ): Promise<void> {
    const account = await this.hasuraSystemService.getAccount(booking.client.user_id, booking.currency);
    if (!account?.id) throw new HttpException('Account missing', HttpStatus.BAD_GATEWAY);
    await this.releaseRentalHold(
      booking.id,
      Number(hold.client_hold_amount),
      account.id,
      this.holdAttemptId(hold, booking.id)
    );
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_HOLD_STATUS, {
      bookingId: booking.id,
      from: 'active',
      status: 'completed',
    });
  }

  private async debitDeclineRefund(
    booking: { id: string; currency: string; client: { user_id: string } },
    amount: number
  ): Promise<void> {
    const account = await this.hasuraSystemService.getAccount(booking.client.user_id, booking.currency);
    if (!account?.id) throw new HttpException('Account missing', HttpStatus.BAD_GATEWAY);
    const paid = await this.accountsService.registerTransaction({
      accountId: account.id,
      amount,
      transactionType: 'payment',
      memo: `Condition decline refund ${booking.id}`,
      referenceId: booking.id,
      idempotencyKey: rentalLedgerKey(booking.id, 'decline:refund'),
    });
    if (paid?.success || (await this.debitAppears(booking.id))) return;
    assertLedgerResult(paid, 'decline refund');
  }

  private async debitAppears(bookingId: string): Promise<boolean> {
    if (await this.declineRefundDebited(bookingId)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return this.declineRefundDebited(bookingId);
  }

  /** Payout did not land. Put the debited amount back in the wallet and alert the caller. */
  async restoreDeclinePayout(
    booking: { id: string; currency: string; client: { user_id: string } },
    amount: number
  ): Promise<void> {
    if (!(amount > 0)) return;
    const account = await this.hasuraSystemService.getAccount(booking.client.user_id, booking.currency);
    if (!account?.id) throw new HttpException('Account missing', HttpStatus.BAD_GATEWAY);
    const credited = await this.accountsService.registerTransaction({
      accountId: account.id,
      amount,
      transactionType: 'deposit',
      memo: `Condition decline refund returned ${booking.id}`,
      referenceId: booking.id,
      idempotencyKey: rentalLedgerKey(booking.id, 'decline:refund:reversal'),
    });
    assertLedgerResult(credited, 'decline refund reversal');
  }

  private async cancelStripeAuthorizationIfAny(booking: any): Promise<void> {
    const bookingNumber = booking.booking_number as string | undefined;
    if (!bookingNumber) return;
    const result = await this.stripeCaptureService.cancelOrderPaymentIntent({
      orderNumber: bookingNumber,
      orderId: booking.id,
    });
    if (!result.success && !result.skipped) {
      if ((result.message ?? '').toLowerCase().includes('use refund')) {
        await this.refundCapturedCard(bookingNumber, booking.id);
        return;
      }
      this.logger.error(
        `cancelStripeAuthorizationIfAny failed for ${bookingNumber}: ${result.message}`
      );
      throw new HttpException(
        'Could not release the card authorization. Please try again.',
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  private async refundCapturedCard(bookingNumber: string, bookingId: string): Promise<void> {
    const refunded = await this.stripeCaptureService.refundCapturedPayment({
      orderNumber: bookingNumber,
      idempotencyKey: rentalLedgerKey(bookingId, 'decline:card-refund'),
    });
    if (!refunded.success) {
      throw new HttpException(
        'Could not refund the captured card payment. Please try again.',
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  private async notifyRentalBookingCancelled(
    booking: any,
    cancelledBy: 'client' | 'business'
  ): Promise<void> {
    try {
      await this.notificationsService.sendRentalBookingCancelledPush({
        recipientUserId:
          cancelledBy === 'client'
            ? booking.business?.user_id
            : booking.client?.user_id,
        rentalItemName:
          booking.rental_location_listing?.rental_item?.name ?? 'Rental',
        bookingId: booking.id,
        bookingNumber: booking.booking_number ?? '',
        cancelledBy,
      });
    } catch (error: any) {
      this.logger.warn(
        `notifyRentalBookingCancelled: ${error?.message ?? String(error)}`
      );
    }
  }

  async getStartPinForClient(bookingId: string): Promise<never> {
    this.logger?.debug?.(`start pin retired ${bookingId}`);
    throw pinRetired();
  }

  async getBookingDetailForViewer(bookingId: string) {
    const r = await this.hasuraUserService.executeQuery<{
      rental_bookings_by_pk: any | null;
    }>(Q.GET_RENTAL_BOOKING_DETAIL_FOR_VIEWER, { id: bookingId });
    const booking = r.rental_bookings_by_pk;
    if (!booking) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }
    const user = await this.hasuraUserService.getUser();
    if (
      isActivePersona(user, 'client') &&
      user.client?.id &&
      user.client.id === booking.client_id
    ) {
      await this.attachAcceptStartPreview(booking);
    }
    this.attachStartOpens(booking);
    return booking;
  }

  /** Renter start for every booking. Pays Mobile Money first, then marks started. */
  async startRental(bookingId: string): Promise<AcceptAndStartResult> {
    const actor = await this.requireStartClient(bookingId);
    this.assertBookingStartWindow(actor.booking);
    if (this.rentalAlreadyRunning(actor.booking)) return this.replayAcceptStart(actor.booking);
    const gate = await this.readInspectionStart(bookingId);
    this.assertPickupReady(gate);
    const result = await this.payAndStartAccepted(actor.booking);
    return this.withStartOpens(actor.booking, result);
  }

  private async requireStartClient(bookingId: string) {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException('Only the renter can start this rental', HttpStatus.FORBIDDEN);
    }
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.client_id !== user.client.id) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    return { booking };
  }

  private rentalAlreadyRunning(booking: { status?: string }): boolean {
    return ['active', 'awaiting_return', 'completed'].includes(booking.status ?? '');
  }

  private assertPickupReady(gate: PickupGateBooking): void {
    if (gate.inspectionPolicyVersion == null || pickupStartAllowed(gate)) return;
    throw new HttpException('Check the item before starting this rental.', HttpStatus.CONFLICT);
  }

  private assertBookingStartWindow(booking: any): void {
    const zone = listingZoneFor(this.bookingCountry(booking));
    const startAt = new Date(booking?.start_at);
    const state = startWindowState({
      now: new Date(),
      startAt,
      endAt: new Date(booking?.end_at),
      timeZone: zone,
    });
    if (state === 'open' || state === 'unknown') return;
    throw startWindowClosed(startOpensAt(startAt, zone), state);
  }

  private withStartOpens(booking: any, result: AcceptAndStartResult): AcceptAndStartResult {
    const opens = this.opensAt(booking);
    return opens ? { ...result, start_opens_at: opens } : result;
  }

  private attachStartOpens(booking: any): void {
    const opens = this.opensAt(booking);
    if (opens) booking.start_opens_at = opens;
  }

  private opensAt(booking: any): string | null {
    const opens = startOpensAt(new Date(booking?.start_at), listingZoneFor(this.bookingCountry(booking)));
    return Number.isNaN(opens.getTime()) ? null : opens.toISOString();
  }

  private bookingCountry(booking: any): string | null | undefined {
    return booking?.rental_location_listing?.business_location?.address?.country;
  }

  async reportItemNotCollected(bookingId: string): Promise<{ success: true; alreadyReported: boolean }> {
    const booking = await this.requireCollectReport(bookingId);
    const first = await this.notificationsService.recordItemNotCollected({
      businessUserId: booking.business.user_id,
      bookingId,
      bookingNumber: booking.booking_number ?? '',
      rentalItemName: booking.rental_location_listing?.rental_item?.name ?? 'Rental',
    });
    return { success: true, alreadyReported: !first };
  }

  private async requireCollectReport(bookingId: string) {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException('Only the business can report this', HttpStatus.FORBIDDEN);
    }
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.business_id !== user.business.id) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    if (booking.status !== 'confirmed' && booking.status !== 'active') {
      throw new HttpException('This rental is not waiting for pickup', HttpStatus.CONFLICT);
    }
    return booking;
  }

  async acceptAndStartRental(
    bookingId: string,
    versionId: string
  ): Promise<AcceptAndStartResult> {
    const actor = await this.requireAcceptStartClient(bookingId);
    this.assertBookingStartWindow(actor.booking);
    const gate = await this.readInspectionStart(bookingId);
    this.assertAcceptStartOpen(actor.booking, gate, versionId);
    if (this.acceptStartFinished(actor.booking, gate, versionId)) {
      return this.replayAcceptStart(actor.booking);
    }
    await this.acceptPickupVersion(actor.booking, gate, versionId, actor.userId);
    return this.startThenNotify(actor.booking);
  }

  private async requireAcceptStartClient(bookingId: string) {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException('Only the renter can accept and start', HttpStatus.FORBIDDEN);
    }
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.client_id !== user.client.id) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    if (booking.inspection_policy_version == null) throw acceptStartNotEnrolled();
    return { booking, userId: user.id as string };
  }

  private assertAcceptStartOpen(booking: any, gate: PickupGateBooking, versionId: string): void {
    if (gate.pickupCurrentVersionId !== versionId) throw acceptStartConflict();
    const open = ['reserved', 'confirmed', 'active', 'awaiting_return', 'completed'];
    if (!open.includes(booking.status)) {
      throw acceptStartConflict('This rental can no longer be started.');
    }
  }

  private acceptStartFinished(booking: any, gate: PickupGateBooking, versionId: string): boolean {
    const started = ['active', 'awaiting_return', 'completed'].includes(booking.status);
    return started && gate.pickupAckCurrent && gate.pickupAcceptedVersionId === versionId;
  }

  private async acceptPickupVersion(
    booking: any,
    gate: PickupGateBooking,
    versionId: string,
    actorId: string
  ): Promise<void> {
    if (gate.pickupAckCurrent && gate.pickupAcceptedVersionId === versionId) return;
    await this.writePickupAccept(booking.id, versionId, actorId);
  }

  /** Write the accept first. The notice follows the start result, not a balance guess. */
  private async startThenNotify(booking: any): Promise<AcceptAndStartResult> {
    try {
      const result = await this.payAndStartAccepted(booking);
      await this.notifyAcceptOutcome(booking, result.started, result.paymentPending);
      return result;
    } catch (error: any) {
      try {
        await this.notifyAcceptFailure(booking);
      } catch (noticeError: any) {
        this.logger?.warn(`notifyAcceptFailure ${booking?.id}: ${noticeError?.message ?? noticeError}`);
      }
      throw error;
    }
  }

  private async notifyAcceptOutcome(
    booking: any,
    started: boolean,
    paymentPending: boolean
  ): Promise<void> {
    await this.notifyPickupAccepted(booking, await this.noticeAfterStart(booking, started, paymentPending));
  }

  private async noticeAfterStart(
    booking: any,
    started: boolean,
    paymentPending: boolean
  ): Promise<'skip' | 'plain' | 'pending'> {
    const country = booking.rental_location_listing?.business_location?.address?.country;
    if (!(await this.inspectionFlags.confirmationsEnabled(country))) return 'plain';
    if (started) return 'skip';
    return paymentPending ? 'pending' : 'plain';
  }

  private async notifyAcceptFailure(booking: any): Promise<void> {
    const pending = await this.failurePaymentPending(booking);
    await this.notifyAcceptOutcome(booking, false, pending);
  }

  private async failurePaymentPending(booking: any): Promise<boolean> {
    const number = booking.booking_number as string | undefined;
    const pending = this.mobilePaymentsDatabaseService?.hasPendingRentalBookingPayment;
    if (!number || !pending) return false;
    try {
      return await pending.call(this.mobilePaymentsDatabaseService, number);
    } catch (error: any) {
      return false;
    }
  }

  private async writePickupAccept(bookingId: string, versionId: string, actorId: string) {
    try {
      const result = await this.hasuraSystemService.executeMutation<{
        rental_accept_pickup_version?: Array<{ id: string }>;
      }>(ACCEPT_PICKUP_VERSION, { id: bookingId, version: versionId, actor: actorId });
      if ((result?.rental_accept_pickup_version?.length ?? 0) > 0) return;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (!this.acceptConflictText(error)) throw error;
    }
    if (await this.versionAlreadyAccepted(bookingId, versionId)) return;
    throw acceptStartConflict();
  }

  /** A racing accept of this same version is success, not a new 409. */
  private async versionAlreadyAccepted(bookingId: string, versionId: string): Promise<boolean> {
    const gate = await this.readInspectionStart(bookingId);
    return gate.pickupAckCurrent && gate.pickupAcceptedVersionId === versionId;
  }

  private acceptConflictText(error: any): boolean {
    const text = JSON.stringify(error?.response ?? error?.message ?? error);
    return text.includes('rental_inspection_ack_conflict') || text.includes('Uniqueness violation');
  }

  private async payAndStartAccepted(booking: any): Promise<AcceptAndStartResult> {
    const fresh = await this.fetchBooking(booking.id);
    if (!fresh) throw acceptStartConflict('Booking status changed');
    const ready = acceptStartPaymentRail({
      status: fresh.status,
      paymentStatus: fresh.payment_status,
      walletCovers: false,
    });
    if (fresh.status === 'confirmed' && (ready === 'card' || ready === 'wallet')) {
      return this.finishAcceptStart(fresh, ready, 0);
    }
    if (fresh.status !== 'reserved') throw acceptStartConflict('Booking status changed');
    return this.payReservedAcceptStart(fresh);
  }

  private async payReservedAcceptStart(booking: any): Promise<AcceptAndStartResult> {
    const total = Number(booking.total_amount);
    const userId = booking.client.user_id as string;
    const account = await this.hasuraSystemService.getAccount(userId, booking.currency);
    if (!account?.id) throw new HttpException('Client account missing', HttpStatus.BAD_REQUEST);
    if (Number(account.available_balance ?? 0) >= total) return this.walletAcceptStart(booking, userId);
    await this.pushMomoPickupPayment(booking, account.id, userId);
    return this.acceptStartBody(booking, 'mobile_money', total, false, true);
  }

  private async walletAcceptStart(booking: any, userId: string): Promise<AcceptAndStartResult> {
    const total = Number(booking.total_amount);
    const confirmed = await this.confirmWalletContract({
      booking,
      previousStatus: 'reserved',
      clientUserId: userId,
      notes: 'Contract paid at pickup (wallet)',
    });
    if (!confirmed) throw acceptStartConflict('Booking status changed');
    const fresh = await this.fetchBooking(booking.id);
    if (!fresh || (fresh.status !== 'confirmed' && fresh.status !== 'active')) {
      throw acceptStartConflict('Booking status changed');
    }
    if (fresh.status === 'active') return this.acceptStartBody(fresh, 'wallet', total, true, false);
    return this.finishAcceptStart(fresh, 'wallet', total);
  }

  private async finishAcceptStart(
    booking: any,
    rail: AcceptStartPaymentRail,
    due: number
  ): Promise<AcceptAndStartResult> {
    const won = await this.markInspectionOrLegacyStart(booking.id);
    if (won) {
      await this.logHistory(
        booking.id,
        'active',
        'confirmed',
        booking.client?.user_id ?? null,
        'client',
        'Accept and start'
      );
    } else {
      await this.startBlockedOrConflict(booking.id);
    }
    if (won) await this.notifyRentalActivated(booking);
    return this.acceptStartBody(booking, rail, due, true, false);
  }

  private async replayAcceptStart(booking: any): Promise<AcceptAndStartResult> {
    const paid = booking.payment_status === 'authorized' || booking.payment_status === 'paid';
    const due = paid ? 0 : Number(booking.total_amount) || 0;
    return this.acceptStartBody(booking, await this.replayPaymentRail(booking), due, true, false, true);
  }

  private async replayPaymentRail(booking: any): Promise<AcceptStartPaymentRail> {
    if (booking.payment_status === 'authorized') return 'card';
    const bookingNumber = booking.booking_number as string | undefined;
    if (bookingNumber) {
      const momo = await this.mobilePaymentsDatabaseService.hasSuccessfulRentalBookingPayment(
        bookingNumber
      );
      if (momo) return 'mobile_money';
    }
    return 'wallet';
  }

  private acceptStartBody(
    booking: any,
    rail: AcceptStartPaymentRail,
    due: number,
    started: boolean,
    paymentPending: boolean,
    alreadyStarted = false
  ): AcceptAndStartResult {
    return {
      success: true,
      accepted: true,
      started,
      alreadyStarted,
      paymentPending,
      payment_rail: rail,
      amount_due_at_pickup: due,
      bookingId: booking.id,
    };
  }

  private async notifyPickupAccepted(booking: any, mode: 'skip' | 'plain' | 'pending'): Promise<void> {
    const userId = booking.business?.user_id as string | undefined;
    if (!userId || mode === 'skip') return;
    try {
      await this.notificationsService.sendRentalInspectionNotice({
        userId,
        kind: 'pickup_accepted',
        persona: 'business',
        rentalItemName: booking.rental_location_listing?.rental_item?.name ?? 'Rental',
        bookingId: booking.id,
        renterName: booking.client?.user?.first_name,
        endAt: booking.end_at,
        countryCode: booking.rental_location_listing?.business_location?.address?.country,
        paymentPending: mode === 'pending',
      });
    } catch (error: any) {
      this.logger?.warn(`notifyPickupAccepted ${booking.id}: ${error?.message ?? error}`);
    }
  }

  private async notifyRentalActivated(booking: any): Promise<void> {
    await this.notifyBusinessRentalStarted(booking);
    await this.notifyRentalStartedIfEnabled(booking);
  }

  private async notifyBusinessRentalStarted(booking: any): Promise<void> {
    const userId = booking.business?.user_id as string | undefined;
    if (!userId) return;
    try {
      const country = booking.rental_location_listing?.business_location?.address?.country;
      await this.notificationsService.sendBusinessRentalStarted({
        businessUserId: userId,
        rentalItemName: booking.rental_location_listing?.rental_item?.name ?? 'Rental',
        bookingId: booking.id,
        renterName: booking.client?.user?.first_name,
        endAt: booking.end_at,
        countryCode: country,
      });
    } catch (error: any) {
      this.logger?.warn(`notifyBusinessRentalStarted ${booking.id}: ${error?.message ?? error}`);
    }
  }

  private async notifyRentalStartedIfEnabled(booking: any): Promise<void> {
    const userId = booking.client?.user_id as string | undefined;
    if (!userId) return;
    try {
      const country = booking.rental_location_listing?.business_location?.address?.country;
      if (!(await this.inspectionFlags.confirmationsEnabled(country))) return;
      await this.notificationsService.sendRentalStartedClientPush({
        clientUserId: userId,
        rentalItemName: booking.rental_location_listing?.rental_item?.name ?? 'Rental',
        bookingId: booking.id,
        endAt: booking.end_at,
        countryCode: country,
      });
    } catch (error: any) {
      this.logger?.warn(`notifyRentalStarted ${booking.id}: ${error?.message ?? error}`);
    }
  }

  private async attachAcceptStartPreview(booking: any): Promise<void> {
    const preview = await this.previewAcceptStart(booking);
    if (preview) booking.accept_start_preview = preview;
  }

  private async previewAcceptStart(booking: any) {
    if (booking?.inspection_policy_version == null || booking.actual_start_at) return null;
    if (booking.payment_status === 'authorized') {
      return { payment_rail: 'card' as const, amount_due_at_pickup: 0 };
    }
    if (booking.status === 'confirmed' && booking.payment_status === 'paid') {
      return { payment_rail: 'wallet' as const, amount_due_at_pickup: 0 };
    }
    if (booking.status !== 'reserved') return null;
    return this.previewReservedRail(booking);
  }

  private async previewReservedRail(booking: any) {
    const total = Number(booking.total_amount) || 0;
    const userId = booking.client?.user?.id ?? booking.client?.user_id;
    if (!userId) return { payment_rail: 'mobile_money' as const, amount_due_at_pickup: total };
    try {
      const account = await this.hasuraSystemService.getAccount(userId, booking.currency);
      const covers = Number(account?.available_balance ?? 0) >= total;
      const payment_rail = covers ? ('wallet' as const) : ('mobile_money' as const);
      return { payment_rail, amount_due_at_pickup: total };
    } catch {
      return { payment_rail: 'mobile_money' as const, amount_due_at_pickup: total };
    }
  }

  private async startEnrolledAfterPickupPayment(booking: any): Promise<void> {
    if (booking.status !== 'reserved' && booking.payment_timing !== 'pay_at_pickup') return;
    const gate = await this.readInspectionStart(booking.id);
    if (gate.inspectionPolicyVersion != null && !pickupStartAllowed(gate)) return;
    const fresh = await this.fetchBooking(booking.id);
    if (fresh?.status !== 'confirmed') return;
    await this.finishPaymentStart(fresh);
  }

  private async finishPaymentStart(fresh: any): Promise<void> {
    try {
      const won = await this.markInspectionOrLegacyStart(fresh.id);
      if (!won) return;
      await this.notePaymentStart(fresh);
    } catch (error: any) {
      if (!this.isStartWindowError(error)) throw error;
      this.logger?.warn(`start window closed after payment ${fresh.id}`);
    }
  }

  private async notePaymentStart(fresh: any): Promise<void> {
    await this.logHistory(
      fresh.id,
      'active',
      'confirmed',
      fresh.client?.user_id ?? null,
      'system',
      'Started after Mobile Money'
    );
    await this.notifyRentalActivated(fresh);
  }

  private isStartWindowError(error: any): boolean {
    if (!(error instanceof HttpException)) return false;
    const body = error.getResponse() as { code?: string };
    return body?.code === START_WINDOW_CODE;
  }

  async verifyRentalStartPin(bookingId: string, body: VerifyRentalStartPinDto): Promise<never> {
    this.logger?.debug?.(`start pin retired ${bookingId} ${body?.pin ? 'pin' : 'code'}`);
    throw pinRetired();
  }

  async generateStartOverwriteCode(bookingId: string): Promise<never> {
    this.logger?.debug?.(`start overwrite retired ${bookingId}`);
    throw pinRetired();
  }

  /** Old support PIN codes are retired. The renter starts the rental. */
  async issueStartOverwriteCodeForSupport(
    bookingId: string,
    actorUserId: string,
    reason: string
  ): Promise<never> {
    this.logger?.debug?.(`support start code retired ${bookingId} ${actorUserId} ${reason}`);
    throw pinRetired();
  }

  /**
   * Business confirms the item was returned. Allowed while `active` (early
   * return) or `awaiting_return`. Optional `actualEndAt` drives overtime math
   * and defaults to now.
   */
  async confirmRentalReturn(
    bookingId: string,
    actualEndAtInput?: string
  ) {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException('Only businesses', HttpStatus.FORBIDDEN);
    }
    const booking = await this.fetchBooking(bookingId);
    if (!booking || booking.business_id !== user.business.id) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    return this.settleOpenReturn(
      booking,
      user.id,
      'business',
      'Return confirmed',
      actualEndAtInput
    );
  }

  /** Same settlement as the business confirm. Records the support actor and reason. */
  async confirmLegacyReturnForSupport(
    bookingId: string,
    actorId: string,
    reason: string
  ) {
    const booking = await this.fetchBooking(bookingId);
    if (!booking) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return this.settleOpenReturn(
      booking,
      actorId,
      'system',
      `Support confirmed the return. ${reason}`
    );
  }

  private async settleOpenReturn(
    booking: any,
    actorId: string,
    changedByType: 'business' | 'system',
    notes: string,
    actualEndAtInput?: string
  ) {
    this.assertReturnStillOpen(booking);
    const policy = await this.readInspectionPolicy(booking.id);
    if (policy != null) throw inspectionUpdateRequired();
    const previous = booking.status as 'active' | 'awaiting_return';
    const actualEndAt = await this.resolveActualReturnAt(booking, actualEndAtInput);
    const settlement = this.computeRentalSettlement(booking, actualEndAt);
    return this.finishOpenReturn(booking, settlement, previous, actorId, changedByType, notes);
  }

  private assertReturnStillOpen(booking: { status?: string }): void {
    if (booking.status === 'awaiting_return' || booking.status === 'active') return;
    throw new HttpException(
      'Booking must be active or awaiting return',
      HttpStatus.BAD_REQUEST
    );
  }

  private async finishOpenReturn(
    booking: any,
    settlement: RentalReturnSettlement,
    previous: 'active' | 'awaiting_return',
    actorId: string,
    changedByType: 'business' | 'system',
    notes: string
  ) {
    if (booking.payment_status === 'authorized') {
      const won = await this.runCompletion(
        booking.id, previous, actorId, changedByType,
        () => this.settleStripeAuthorizedBooking(booking, settlement),
        notes
      );
      return this.completionResult(won, settlement.overtimeAmount);
    }
    if (await this.overtimeNeedsMobileMoney(booking, settlement.overtimeAmount)) {
      await this.logHistory(booking.id, previous, previous, actorId, changedByType, notes);
      return this.deferReturnForOvertimePayment(
        booking, settlement.overtimeAmount, previous, actorId
      );
    }
    const won = await this.runCompletion(
      booking.id, previous, actorId, changedByType,
      () => this.settleWalletHeldBooking(booking, settlement),
      notes
    );
    return this.completionResult(won, settlement.overtimeAmount);
  }

  /**
   * Stamp the return moment once so overtime math and retries stay stable.
   * When not already set, uses the owner-selected time (or now).
   */
  private async resolveActualReturnAt(
    booking: any,
    actualEndAtInput?: string
  ): Promise<string> {
    const existing = booking.actual_end_at as string | null | undefined;
    if (existing) return existing;
    const iso = this.normalizeReturnActualEndAt(booking, actualEndAtInput);
    const stamped = await this.hasuraSystemService.executeMutation<{
      update_rental_bookings: {
        returning: Array<{ actual_end_at: string }>;
      } | null;
    }>(Q.STAMP_RENTAL_ACTUAL_END_IF_ABSENT, { id: booking.id, at: iso });
    const written = stamped.update_rental_bookings?.returning?.[0]?.actual_end_at;
    if (written) return written;
    const fresh = await this.fetchBooking(booking.id);
    return (fresh?.actual_end_at as string | undefined) ?? iso;
  }

  private normalizeReturnActualEndAt(
    booking: any,
    actualEndAtInput?: string
  ): string {
    const end = actualEndAtInput?.trim()
      ? new Date(actualEndAtInput.trim())
      : new Date();
    if (Number.isNaN(end.getTime())) {
      throw new HttpException('Invalid actualEndAt', HttpStatus.BAD_REQUEST);
    }
    const now = Date.now();
    if (end.getTime() > now + 60_000) {
      throw new HttpException(
        'Return time cannot be in the future',
        HttpStatus.BAD_REQUEST
      );
    }
    const startedAt = booking.actual_start_at
      ? new Date(booking.actual_start_at).getTime()
      : null;
    if (startedAt != null && end.getTime() < startedAt) {
      throw new HttpException(
        'Return time cannot be before the rental start',
        HttpStatus.BAD_REQUEST
      );
    }
    return end.toISOString();
  }

  /**
   * Return-time math (per rental deposit policy):
   * - early return still pays the full contract;
   * - late return owes ceil(hours past booked end) at the listing hourly rate;
   * - on Stripe the overtime comes out of the deposit (capped by it).
   */
  private computeRentalSettlement(
    booking: any,
    actualEndAtIso: string
  ): RentalReturnSettlement {
    const contract = Number(booking.total_amount);
    const deposit = Math.max(0, Number(booking.security_deposit_amount) || 0);
    const units = Math.max(1, Number(booking.units_booked) || 1);
    const hourly = this.resolveBookingHourlyRate(booking);
    const lateMs =
      new Date(actualEndAtIso).getTime() - new Date(booking.end_at).getTime();
    const overtimeHours = Math.max(0, Math.ceil(lateMs / 3600000));
    const overtimeAmount = Number((overtimeHours * hourly * units).toFixed(2));
    return {
      contract,
      deposit,
      overtimeHours,
      overtimeAmount,
      stripeCharge: Number(
        (contract + Math.min(overtimeAmount, deposit)).toFixed(2)
      ),
    };
  }

  private resolveBookingHourlyRate(booking: any): number {
    const snap = booking.rental_pricing_snapshot as
      | RentalPricingSnapshotDto
      | undefined;
    const hourlyLine = (snap?.lines ?? []).find(
      (l): l is RentalPricingLine & { ratePerHour: number } =>
        l.kind === 'hourly'
    );
    const fromSnapshot =
      Number(hourlyLine?.ratePerHour) || Number(snap?.ratePerHour);
    if (Number.isFinite(fromSnapshot) && fromSnapshot > 0) return fromSnapshot;
    return Math.max(
      0,
      Number(booking.rental_location_listing?.base_price_per_hour) || 0
    );
  }

  /** Capture contract + capped overtime from the Stripe authorization; ledger the proceeds. */
  private async settleStripeAuthorizedBooking(
    booking: any,
    settlement: RentalReturnSettlement
  ): Promise<void> {
    const authorized =
      Number(booking.authorized_amount) ||
      settlement.contract + settlement.deposit;
    const charge = Math.min(settlement.stripeCharge, authorized);
    const capture = await this.stripeCaptureService.captureRentalBookingPaymentIntent({
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
      amountToCapture: charge,
    });
    if (!capture.success) {
      throw new HttpException(
        capture.message || 'Stripe capture failed',
        HttpStatus.BAD_GATEWAY
      );
    }
    await this.creditClientWalletForStripeCapture(booking, charge);
    await this.registerRentalProceedsLedger(booking, charge, 'Stripe capture');
    await this.patchBooking(booking.id, {
      captured_amount: charge,
      overtime_amount: Number(
        Math.min(settlement.overtimeAmount, settlement.deposit).toFixed(2)
      ),
      payment_status: 'paid',
    });
  }

  /**
   * Wallet/mobile-money settle: release the contract hold and pay the business.
   * Overtime is charged from the wallet when the balance covers it. The caller
   * sends the mobile-money push before this runs when it does not.
   */
  private async settleWalletHeldBooking(
    booking: any,
    settlement: RentalReturnSettlement
  ): Promise<boolean> {
    if (settlement.overtimeAmount <= 0) {
      await this.settleBooking(booking);
      return true;
    }
    await this.patchBooking(booking.id, {
      overtime_amount: settlement.overtimeAmount,
    });
    const clientAccount = await this.hasuraSystemService.getAccount(
      booking.client.user_id,
      booking.currency
    );
    if (
      Number(clientAccount?.available_balance ?? 0) < settlement.overtimeAmount
    ) {
      throw new HttpException(
        'Client balance no longer covers overtime',
        HttpStatus.CONFLICT
      );
    }
    await this.settleBooking(booking);
    await this.registerRentalProceedsLedger(
      booking,
      settlement.overtimeAmount,
      'Overtime'
    );
    return true;
  }

  /** Charge the client wallet and credit the business account for `amount`. */
  private async registerRentalProceedsLedger(
    booking: any,
    amount: number,
    label: string
  ): Promise<void> {
    if (amount <= 0) return;
    const clientAccount = await this.hasuraSystemService.getAccount(
      booking.client.user_id,
      booking.currency
    );
    const locId = booking.rental_location_listing?.business_location_id;
    if (!locId) {
      throw new HttpException('Location missing', HttpStatus.BAD_REQUEST);
    }
    const businessAccount =
      await this.hasuraSystemService.ensureAccountForBusinessLocation(locId);
    if (!businessAccount?.id) {
      throw new HttpException('Business account missing', HttpStatus.BAD_REQUEST);
    }
    const leg = rentalProceedsLeg(label);
    const paid = await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount,
      transactionType: 'payment',
      memo: `Rental ${label} ${booking.id}`,
      referenceId: booking.id,
      idempotencyKey: rentalLedgerKey(booking.id, `${leg}:payment`),
    });
    assertLedgerResult(paid, `${leg} payment`);
    const credited = await this.accountsService.registerTransaction({
      accountId: businessAccount.id,
      amount,
      transactionType: 'deposit',
      memo: `Rental ${label} proceeds ${booking.id}`,
      referenceId: booking.id,
      idempotencyKey: rentalLedgerKey(booking.id, `${leg}:proceeds`),
    });
    assertLedgerResult(credited, `${leg} proceeds`);
  }

  /** Stripe capture credits the client wallet first so payment + proceeds net to zero. */
  private async creditClientWalletForStripeCapture(
    booking: any,
    amount: number
  ): Promise<void> {
    const clientAccount = await this.hasuraSystemService.getAccount(
      booking.client.user_id,
      booking.currency
    );
    const credited = await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount,
      transactionType: 'deposit',
      memo: `Stripe rental capture ${booking.id}`,
      referenceId: booking.id,
      idempotencyKey: rentalLedgerKey(booking.id, 'stripe-capture:credit'),
    });
    assertLedgerResult(credited, 'stripe capture credit');
  }

  /** Push a mobile-money request for outstanding overtime at return. */
  private async initiateRentalOvertimePayment(
    booking: any,
    overtimeAmount: number,
    clientAccountId: string
  ): Promise<void> {
    const bookingNumber = booking.booking_number as string;
    const pending =
      await this.mobilePaymentsDatabaseService.hasPendingRentalBookingPayment(
        bookingNumber
      );
    if (pending) return;
    const clientUser = await this.fetchUserContact(booking.client.user_id);
    await this.initiateRentalBookingPayment({
      bookingNumber,
      amount: overtimeAmount,
      currency: booking.currency,
      clientAccountId,
      userId: booking.client.user_id,
      phoneNumber: clientUser?.phone_number || '',
      email: clientUser?.email,
      purpose: 'overtime',
      paymentEntity: 'rental_booking',
      itemCountry: resolveItemCountry(
        booking.rental_location_listing?.business_location?.address?.country
      ),
    });
  }

  /** Overtime mobile-money payment landed: ledger it, settle the hold, complete. */
  private async finalizeRentalOvertimeAfterPayment(booking: any): Promise<void> {
    const overtime = Number(booking.overtime_amount) || 0;
    await this.runCompletion(booking.id, 'awaiting_return', null, 'system', async () => {
      await this.registerRentalProceedsLedger(booking, overtime, 'Overtime');
      const hold = await this.getHold(booking.id);
      if (hold?.status === 'active') await this.settleBooking(booking);
    });
  }

  /**
   * Claim `completed` before money moves. A loser settles nothing.
   * A thrown settle puts the booking back so a retry can win.
   */
  private async runCompletion(
    bookingId: string,
    from: 'active' | 'awaiting_return',
    userId: string | null,
    changedByType: 'business' | 'system',
    settle: () => Promise<unknown>,
    notes = 'Return confirmed'
  ): Promise<boolean> {
    const won = await this.casBooking(bookingId, [from], { status: 'completed' });
    if (!won) return false;
    try {
      await settle();
    } catch (error) {
      await this.casBooking(bookingId, ['completed'], { status: from });
      throw error;
    }
    await this.logHistory(
      bookingId,
      'completed',
      from,
      userId,
      changedByType,
      notes
    );
    await this.deliveryPinService.clearPinForOrder(bookingId);
    return true;
  }

  private completionResult(won: boolean, overtimeAmount: number) {
    return won
      ? { success: true, overtimeAmount }
      : { success: true, alreadyCompleted: true, overtimeAmount };
  }

  private async overtimeNeedsMobileMoney(
    booking: any,
    overtimeAmount: number
  ): Promise<boolean> {
    if (overtimeAmount <= 0) return false;
    const account = await this.hasuraSystemService.getAccount(
      booking.client.user_id,
      booking.currency
    );
    return Number(account?.available_balance ?? 0) < overtimeAmount;
  }

  private async deferReturnForOvertimePayment(
    booking: any,
    overtimeAmount: number,
    previous: 'active' | 'awaiting_return',
    userId: string
  ) {
    const open = await this.casBooking(
      booking.id,
      ['active', 'awaiting_return'],
      { overtime_amount: overtimeAmount }
    );
    if (!open) return this.completionResult(false, overtimeAmount);
    await this.noteAwaitingReturn(booking.id, previous, userId);
    await this.pushOvertimeCharge(booking, overtimeAmount);
    return {
      success: true,
      overtimeDue: true,
      overtimeAmount,
      paymentPending: true,
    };
  }

  private async noteAwaitingReturn(
    bookingId: string,
    previous: 'active' | 'awaiting_return',
    userId: string
  ): Promise<void> {
    if (previous !== 'active') return;
    const won = await this.casBooking(bookingId, ['active'], {
      status: 'awaiting_return',
    });
    if (!won) return;
    await this.logHistory(
      bookingId,
      'awaiting_return',
      'active',
      userId,
      'business',
      'Return recorded; overtime payment pending'
    );
  }

  private async pushOvertimeCharge(booking: any, overtimeAmount: number) {
    const clientAccount = await this.hasuraSystemService.getAccount(
      booking.client.user_id,
      booking.currency
    );
    if (!clientAccount?.id) {
      throw new HttpException('Client account missing', HttpStatus.BAD_REQUEST);
    }
    await this.initiateRentalOvertimePayment(
      booking,
      overtimeAmount,
      clientAccount.id
    );
  }

  private casBooking(
    id: string,
    from: string[],
    set: Record<string, unknown>
  ): Promise<boolean> {
    return casUpdateRentalBooking(this.hasuraSystemService, id, from, set);
  }

  private async alreadyCancelledOrConflict(bookingId: string) {
    const fresh = await this.fetchBooking(bookingId);
    if (fresh?.status !== 'cancelled') {
      throw new HttpException('Booking status changed', HttpStatus.CONFLICT);
    }
    await this.releaseHoldIfNeeded(bookingId, fresh);
    return { success: true };
  }

  private async startBlockedOrConflict(bookingId: string) {
    const fresh = await this.fetchBooking(bookingId);
    if (
      fresh?.status === 'active' ||
      fresh?.status === 'awaiting_return' ||
      fresh?.status === 'completed'
    ) {
      return { success: true };
    }
    throw new HttpException('Booking status changed', HttpStatus.CONFLICT);
  }

  /**
   * The inspection start function is the atomic gate. The legacy status claim
   * is only for a booking whose policy is known to be null while that function
   * is not installed yet.
   */
  private async markInspectionOrLegacyStart(bookingId: string): Promise<boolean> {
    const current = await this.fetchBooking(bookingId);
    if (current) this.assertBookingStartWindow(current);
    const policy = await this.readInspectionPolicy(bookingId);
    const at = new Date().toISOString();
    try {
      const result = await this.hasuraSystemService.executeMutation<{
        rental_mark_started?: Array<{ id: string }>;
      }>(
        `mutation MarkStarted($id: uuid!, $at: timestamptz!) {
          rental_mark_started(args: { p_booking_id: $id, p_at: $at }) { id }
        }`,
        { id: bookingId, at }
      );
      if (Object.prototype.hasOwnProperty.call(result ?? {}, 'rental_mark_started')) {
        return (result.rental_mark_started?.length ?? 0) > 0;
      }
      return this.legacyStartIfUnenrolled(policy, bookingId, at);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (!this.missingInspectionFunction(error)) throw error;
      return this.legacyStartIfUnenrolled(policy, bookingId, at);
    }
  }

  private legacyStartIfUnenrolled(
    policy: number | null,
    bookingId: string,
    at: string
  ): Promise<boolean> {
    if (policy !== null) throw inspectionUnavailable();
    return this.casBooking(bookingId, ['confirmed'], {
      status: 'active',
      actual_start_at: at,
    });
  }

  private missingInspectionFunction(error: any): boolean {
    const text = JSON.stringify(error?.response ?? error?.message ?? error);
    return text.includes('rental_mark_started') && text.toLowerCase().includes('not found');
  }

  private async reserveReplayResult(
    bookingId: string
  ): Promise<RentalBookingActionResult> {
    const fresh = await this.fetchBooking(bookingId);
    if (fresh?.status === 'reserved' || fresh?.status === 'confirmed') {
      return {
        success: true,
        bookingId,
        payment_rail: 'mobile_money',
        reserved: fresh.status === 'reserved',
      };
    }
    throw new HttpException('Booking status changed', HttpStatus.CONFLICT);
  }

  private async fetchUserContact(
    userId: string
  ): Promise<{ phone_number?: string | null; email?: string | null } | null> {
    const r = await this.hasuraSystemService.executeQuery<{
      users_by_pk: { phone_number?: string | null; email?: string | null } | null;
    }>(
      `query UserContact($id: uuid!) { users_by_pk(id: $id) { phone_number email } }`,
      { id: userId }
    );
    return r.users_by_pk ?? null;
  }

  /** Business pickup payment is retired. The renter starts the rental. */
  async initiateRentalPickupPayment(bookingId: string): Promise<never> {
    this.logger?.debug?.(`pickup payment retired ${bookingId}`);
    throw pinRetired();
  }

  private async pushMomoPickupPayment(
    booking: any,
    clientAccountId: string,
    clientUserId: string
  ): Promise<RentalBookingActionResult> {
    const bookingNumber = booking.booking_number as string;
    const pending =
      await this.mobilePaymentsDatabaseService.hasPendingRentalBookingPayment(
        bookingNumber
      );
    if (!pending) {
      const clientUser = await this.fetchUserContact(clientUserId);
      await this.initiateRentalBookingPayment({
        bookingNumber,
        amount: Number(booking.total_amount),
        currency: booking.currency,
        clientAccountId,
        userId: clientUserId,
        phoneNumber: clientUser?.phone_number || '',
        email: clientUser?.email,
        purpose: 'contract',
        paymentEntity: 'rental_booking',
        itemCountry: resolveItemCountry(
          booking.rental_location_listing?.business_location?.address?.country
        ),
      });
    }
    return {
      success: true,
      bookingId: booking.id,
      payment_rail: 'mobile_money',
      paymentPending: true,
    };
  }

  private async fetchListing(id: string) {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings_by_pk: any;
    }>(Q.GET_LISTING_FOR_REQUEST, { id });
    return r.rental_location_listings_by_pk;
  }

  private async assertListingBookable(listing: any) {
    this.assertListingActiveAndApproved(listing);
    await this.assertListingLocationPaymentsEnabled(listing);
  }

  private assertListingActiveAndApproved(listing: any) {
    if (!listing?.is_active || !listing.rental_item?.is_active) {
      throw new HttpException('Listing not available', HttpStatus.BAD_REQUEST);
    }
    if (listing.deleted_at || listing.rental_item?.deleted_at) {
      throw new HttpException('Listing not available', HttpStatus.BAD_REQUEST);
    }
    if (listing.moderation_status !== 'approved') {
      throw new HttpException('Listing not available', HttpStatus.BAD_REQUEST);
    }
    if (listing.business_location?.is_active === false) {
      throw new HttpException('Listing not available', HttpStatus.BAD_REQUEST);
    }
    if (!listing.rental_item?.business?.can_accept_orders) {
      throw new HttpException(
        'This merchant is not yet accepting orders',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async assertListingLocationPaymentsEnabled(listing: any) {
    if (await this.isListingPaymentsEnabled(listing)) return;
    throw new HttpException(
      'This location is not available for booking yet. Payments at this location are coming soon.',
      HttpStatus.BAD_REQUEST
    );
  }

  private async isListingPaymentsEnabled(listing: {
    business_location?: {
      address?: { country?: string | null } | null;
      mobile_payment_phone?: { is_verified?: boolean } | null;
    } | null;
  }): Promise<boolean> {
    const stripeCountries = await fetchStripeEnabledCountries(
      this.hasuraSystemService
    );
    return isLocationPaymentsEnabled(
      listing.business_location,
      stripeCountries
    );
  }

  private async filterListingsByPaymentsEnabled(
    rows: PublicRentalListingRow[]
  ): Promise<PublicRentalListingRow[]> {
    const stripeCountries = await fetchStripeEnabledCountries(
      this.hasuraSystemService
    );
    return rows.filter((row) =>
      isLocationPaymentsEnabled(row.business_location, stripeCountries)
    );
  }

  private assertDurationHours(listing: any, hours: number) {
    if (hours < listing.min_rental_hours) {
      throw new HttpException('Below minimum rental hours', HttpStatus.BAD_REQUEST);
    }
    if (listing.max_rental_hours != null && hours > listing.max_rental_hours) {
      throw new HttpException('Above maximum rental hours', HttpStatus.BAD_REQUEST);
    }
  }

  private throwDayHours(violation: DayHoursViolation | null): void {
    if (!violation) return;
    throw new HttpException(
      { message: violation.message, error: violation.message, code: violation.code },
      HttpStatus.BAD_REQUEST
    );
  }

  /** rentals_day_hours_picker_enabled for the listing's country. Off when unreadable. */
  private async dayHoursPickerOn(listing: {
    business_location?: { address?: { country?: string | null } | null } | null;
  }): Promise<boolean> {
    try {
      if (!this.hasuraSystemService) return false;
      const res = await this.hasuraSystemService.executeQuery<{
        application_configurations?: DashboardRequestFlagRow[];
      }>(Q.GET_DAY_HOURS_PICKER_FLAG, {});
      return listingDashboardFlag(
        res?.application_configurations ?? [],
        listing?.business_location?.address?.country
      );
    } catch {
      return false;
    }
  }

  private listingTimeZone(listing: {
    business_location?: { address?: { country?: string | null } | null } | null;
  }): string {
    const country = resolveItemCountry(listing?.business_location?.address?.country);
    return marketTimeZone(country) ?? 'Africa/Douala';
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
    listing: any,
    requestedUnits: number
  ): Promise<void> {
    const earliest = new Date(
      Math.min(...plan.windows.map((w) => w.start.getTime()))
    );
    this.assertRentalRequestStartsInFuture(earliest);
    this.throwDayHours(modeViolation(plan.windows, listing));
    if (await this.dayHoursPickerOn(listing)) {
      this.throwDayHours(
        dayHoursPickerViolation({
          windows: plan.windows,
          listing,
          minHours: listing.block_min_hours ?? listing.min_rental_hours,
          maxHours:
            listing.block_max_hours !== undefined ? listing.block_max_hours : listing.max_rental_hours,
          nowMs: Date.now(),
          timeZone: this.listingTimeZone(listing),
        })
      );
    } else {
      this.assertDurationHours(listing, plan.totalHours);
    }
    this.assertAllDayWindows(plan, listing);
    const weekly = listing.weekly_availability ?? [];
    for (const w of plan.windows) {
      this.assertRequestedWindowInAvailability(w.start, w.end, weekly);
    }
    const unitsAvailable = Math.max(1, Number(listing.units_available) || 1);
    for (const w of plan.windows) {
      if (w.billing === 'all_day' && w.calendarDate) {
        const { start, end } = this.utcDayBoundsFromCalendarDate(w.calendarDate);
        await this.assertCapacity(listing.id, start, end, unitsAvailable, requestedUnits);
      } else {
        await this.assertCapacity(listing.id, w.start, w.end, unitsAvailable, requestedUnits);
      }
    }
  }

  private assertAllDayWindows(plan: RentalRequestWindowPlan, listing: any) {
    const allDay = plan.windows.filter((w) => w.billing === 'all_day');
    if (!allDay.length) return;
    if (!(Number(listing.base_price_per_day) > 0)) {
      throw new HttpException('all_day billing requires a daily price', HttpStatus.BAD_REQUEST);
    }
    for (const w of allDay) this.assertAllDayStaysOnDate(w);
  }

  private assertAllDayStaysOnDate(
    w: RentalRequestWindowEntry
  ): asserts w is RentalRequestWindowEntry & { calendarDate: string } {
    if (!w.calendarDate) {
      throw new HttpException('calendarDate is required for all_day windows', HttpStatus.BAD_REQUEST);
    }
    const { start, end } = this.utcDayBoundsFromCalendarDate(w.calendarDate);
    if (w.start < start || w.end > end) {
      throw new HttpException('all_day window must stay on calendarDate', HttpStatus.BAD_REQUEST);
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
    if (start.toISOString().slice(0, 10) !== calendarDate) {
      throw new HttpException('Invalid calendar_date', HttpStatus.BAD_REQUEST);
    }
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
    unitsAvailable: number,
    req: any,
    requestedUnits: number,
    excludeBookingId?: string
  ): Promise<void> {
    const cap = Math.max(1, Number(unitsAvailable) || 1);
    const want = this.normalizeUnitsRequested(requestedUnits);
    for (const w of this.parseRentalSelectionWindows(req)) {
      if (w.billing === 'all_day' && w.calendarDate) {
        const { start, end } = this.utcDayBoundsFromCalendarDate(w.calendarDate);
        await this.assertCapacity(listingId, start, end, cap, want, excludeBookingId);
      } else {
        await this.assertCapacity(listingId, w.start, w.end, cap, want, excludeBookingId);
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
    const units = this.normalizeUnitsRequested(req.units_requested);
    const lines: RentalPricingLine[] = [];
    let total = 0;
    for (const p of parts) {
      if (p.billing === 'all_day') {
        this.assertAllDayStaysOnDate(p);
        if (!(ratePerDay > 0)) {
          throw new HttpException('all_day billing requires a daily price', HttpStatus.BAD_REQUEST);
        }
        const subtotal = Number((ratePerDay * units).toFixed(2));
        total += subtotal;
        lines.push({
          kind: 'all_day',
          calendarDate: p.calendarDate,
          ratePerDay,
          subtotal,
        });
      } else {
        const h = rentalHoursCount(p.start, p.end);
        const subtotal = Number((h * ratePerHour * units).toFixed(2));
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
    const depositPerUnit = shownSecurityDeposit(
      listing.rental_item?.currency,
      listing.security_deposit_amount
    );
    return {
      version: 4,
      currency: listing.rental_item.currency,
      total: Number(total.toFixed(2)),
      unitsBooked: units,
      securityDeposit: Number((depositPerUnit * units).toFixed(2)),
      lines,
      computedAt: new Date().toISOString(),
    };
  }

  /** Deposit snapshotted on the pricing contract (v4+); 0 for older snapshots. */
  private snapshotSecurityDeposit(snap: RentalPricingSnapshotDto): number {
    const v = Number(snap.securityDeposit);
    return Number.isFinite(v) && v > 0 ? Number(v.toFixed(2)) : 0;
  }

  private normalizeUnitsRequested(value: unknown): number {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) return 1;
    return n;
  }

  private async assertCapacity(
    listingId: string,
    start: Date,
    end: Date,
    unitsAvailable: number,
    requestedUnits: number,
    excludeBookingId?: string
  ) {
    const used = await this.peakUnitsUsedInInterval(
      listingId,
      start,
      end,
      excludeBookingId
    );
    if (used + requestedUnits > unitsAvailable) {
      throw new HttpException('No units available for these dates', HttpStatus.CONFLICT);
    }
  }

  /** Peak concurrent units booked at any instant in [start, end). */
  private async peakUnitsUsedInInterval(
    listingId: string,
    start: Date,
    end: Date,
    excludeBookingId?: string
  ): Promise<number> {
    const now = new Date().toISOString();
    const r = await this.hasuraSystemService.executeQuery<{
      rental_booking_windows: Array<{
        start_at: string;
        end_at: string;
        rental_booking?: { id?: string; units_booked?: number | null } | null;
      }>;
    }>(Q.LIST_OVERLAPPING_BOOKING_WINDOWS, {
      listingId,
      start: start.toISOString(),
      end: end.toISOString(),
      now,
    });
    const windows = (r.rental_booking_windows ?? []).filter(
      (w) =>
        !excludeBookingId || w.rental_booking?.id !== excludeBookingId
    );
    return this.peakConcurrentUnits(
      windows.map((w) => ({
        startMs: new Date(w.start_at).getTime(),
        endMs: new Date(w.end_at).getTime(),
        units: Math.max(1, Number(w.rental_booking?.units_booked) || 1),
      })),
      start.getTime(),
      end.getTime()
    );
  }

  private peakConcurrentUnits(
    windows: Array<{ startMs: number; endMs: number; units: number }>,
    rangeStartMs: number,
    rangeEndMs: number
  ): number {
    return sweepPeakUnits(windows, rangeStartMs, rangeEndMs);
  }

  private async assertUnitsAvailableNotBelowCommitted(
    listingId: string,
    nextUnits: number
  ): Promise<void> {
    if (!Number.isInteger(nextUnits) || nextUnits < 1) {
      throw new HttpException('units_available must be >= 1', HttpStatus.BAD_REQUEST);
    }
    const peak = await this.peakCommittedUnitsForListing(listingId);
    if (nextUnits < peak) {
      throw new HttpException(
        `Cannot set units_available below committed peak usage (${peak})`,
        HttpStatus.CONFLICT
      );
    }
  }

  private async peakCommittedUnitsForListing(listingId: string): Promise<number> {
    const now = new Date().toISOString();
    const r = await this.hasuraSystemService.executeQuery<{
      rental_booking_windows: Array<{
        start_at: string;
        end_at: string;
        rental_booking?: { units_booked?: number | null } | null;
      }>;
    }>(Q.LIST_COMMITTED_RENTAL_BOOKING_WINDOWS_FOR_LISTING, { listingId, now });
    const nowMs = Date.now();
    const farFuture = nowMs + 1000 * 60 * 60 * 24 * 365 * 10;
    return this.peakConcurrentUnits(
      (r.rental_booking_windows ?? []).map((w) => ({
        startMs: new Date(w.start_at).getTime(),
        endMs: new Date(w.end_at).getTime(),
        units: Math.max(1, Number(w.rental_booking?.units_booked) || 1),
      })),
      nowMs,
      farFuture
    );
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
   * One mobile-money row per booking and purpose. A pending row is reused.
   * A failed row releases its key so a later attempt can insert again.
   */
  private async openRentalMomoTransaction(data: {
    reference: string;
    amount: number;
    currency: string;
    description: string;
    provider: string;
    payment_method: string;
    customer_phone: string;
    customer_email?: string;
    account_id: string;
    transaction_type: 'PAYMENT';
    payment_entity: 'rental_booking';
    entity_id: string;
    idempotency_key: string;
  }): Promise<{ tx: { id: string; reference: string; transaction_id?: string | null }; send: boolean }> {
    try {
      const tx = await this.mobilePaymentsDatabaseService.createTransaction(data);
      return { tx, send: true };
    } catch (error) {
      if (!isRentalMomoUniqueViolation(error)) throw error;
      return this.resumeRentalMomoTransaction(data);
    }
  }

  private async resumeRentalMomoTransaction(data: {
    entity_id: string;
    idempotency_key: string;
    reference: string;
    amount: number;
    currency: string;
    description: string;
    provider: string;
    payment_method: string;
    customer_phone: string;
    customer_email?: string;
    account_id: string;
    transaction_type: 'PAYMENT';
    payment_entity: 'rental_booking';
  }): Promise<{ tx: { id: string; reference: string; transaction_id?: string | null }; send: boolean }> {
    const existing = await this.findRentalMomoByKey(
      data.entity_id,
      data.idempotency_key
    );
    const decision = decideRentalMomoRetry(existing);
    if (!existing || decision === 'replace') {
      if (existing) await this.clearRentalMomoKey(existing.id);
      const tx = await this.mobilePaymentsDatabaseService.createTransaction(data);
      return { tx, send: true };
    }
    return { tx: existing, send: decision === 'send' };
  }

  private async findRentalMomoByKey(entityId: string, key: string) {
    const result = await this.hasuraSystemService.executeQuery<{
      mobile_payment_transactions: Array<{
        id: string;
        reference: string;
        status: string;
        transaction_id?: string | null;
        created_at?: string | null;
      }>;
    }>(
      `query RentalMomoByKey($entityId: String!, $key: String!) {
        mobile_payment_transactions(
          where: { entity_id: { _eq: $entityId }, idempotency_key: { _eq: $key } }
          limit: 1
        ) { id reference status transaction_id created_at }
      }`,
      { entityId, key }
    );
    return result.mobile_payment_transactions?.[0] ?? null;
  }

  private async clearRentalMomoKey(id: string): Promise<void> {
    await this.mobilePaymentsDatabaseService.updateTransaction(id, {
      idempotency_key: null,
    });
  }

  private bookingWindowsNestedInput(req: any) {
    return {
      data: this.parseRentalSelectionWindows(req).map(({ start, end }) => ({
        start_at: start.toISOString(),
        end_at: end.toISOString(),
      })),
    };
  }

  private async insertProposedBookingRow(
    req: any,
    clientId: string,
    snap: RentalPricingSnapshotDto,
    total: number,
    contractExpiresAt: string
  ) {
    const envelope = this.requestWindowEnvelope(req);
    const unitsBooked = this.normalizeUnitsRequested(req.units_requested);
    const policyVersion = await this.inspectionPolicyForInsert(req);
    const object = this.proposedBookingInsert(req, clientId, snap, total, contractExpiresAt, envelope, unitsBooked);
    if (policyVersion != null) object.inspection_policy_version = policyVersion;
    return this.reserveProposedBooking(object);
  }

  private async reserveProposedBooking(object: Record<string, unknown>) {
    const saved = await this.hasuraSystemService.executeMutation<{
      reserve_proposed_rental_booking: Array<{ id: string; booking_number: string }>;
    }>(Q.RESERVE_PROPOSED_RENTAL_BOOKING, this.reserveVars(object));
    const row = saved.reserve_proposed_rental_booking?.[0];
    if (!row) throw new HttpException('No units available for these dates', HttpStatus.CONFLICT);
    return { insert_rental_bookings_one: row };
  }

  private reserveVars(object: Record<string, unknown>) {
    const windows = object.rental_booking_windows as { data?: Array<{ start_at: string; end_at: string }> };
    return {
      listingId: object.rental_location_listing_id,
      requestId: object.rental_request_id,
      clientId: object.client_id,
      businessId: object.business_id,
      start: object.start_at,
      end: object.end_at,
      total: object.total_amount,
      currency: object.currency,
      snapshot: object.rental_pricing_snapshot,
      bookingNumber: object.booking_number,
      contractExpiresAt: object.contract_expires_at,
      units: object.units_booked,
      deposit: object.security_deposit_amount ?? 0,
      windows: windows?.data ?? [],
      now: new Date().toISOString(),
      policyVersion: object.inspection_policy_version ?? null,
    };
  }

  async recordSideEffect(
    requestId: string,
    kind: 'release' | 'notify',
    error: unknown,
    payload: Record<string, unknown> = {}
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`rental side effect ${kind} ${requestId}: ${message}`);
    try {
      const saved = await this.hasuraSystemService.executeMutation<{
        enqueue_rental_side_effect: Array<{ attempts: number }>;
      }>(Q.ENQUEUE_RENTAL_SIDE_EFFECT, {
        requestId,
        kind,
        payload: { requestId, kind, ...payload },
        error: message,
      });
      this.noteDeadLetter(kind, requestId, saved.enqueue_rental_side_effect?.[0]?.attempts ?? 0, message, payload);
    } catch (enqueueError: any) {
      this.logger.error(`code=RENTAL_SIDE_EFFECT_DEAD enqueue kind=${kind} request=${requestId}: ${enqueueError?.message ?? enqueueError}`);
    }
  }

  private noteDeadLetter(
    kind: string,
    requestId: string,
    attempts: number,
    message: string,
    payload: Record<string, unknown>
  ): void {
    if (attempts < 5) return;
    const recipients = Array.isArray(payload.recipients) ? payload.recipients.join(',') : '';
    this.logger.error(
      `code=RENTAL_SIDE_EFFECT_DEAD kind=${kind} request=${requestId} attempts=${attempts} recipients=${recipients}: ${message}`
    );
  }

  private proposedBookingInsert(
    req: any,
    clientId: string,
    snap: RentalPricingSnapshotDto,
    total: number,
    contractExpiresAt: string,
    envelope: { startAt: string; endAt: string },
    unitsBooked: number
  ): Record<string, unknown> {
    return {
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
      units_booked: unitsBooked,
      security_deposit_amount: this.snapshotSecurityDeposit(snap),
      rental_booking_windows: this.bookingWindowsNestedInput(req),
    };
  }

  private async inspectionPolicyForInsert(req: any): Promise<number | null> {
    const country = resolveItemCountry(
      req.rental_location_listing?.business_location?.address?.country
    );
    if (await this.optInFlag(country)) {
      if (req.inspection_policy_version == null) return null;
      return this.enrolOrReject(req, country);
    }
    const enabled = await this.inspectionFlags.isEnabled(country);
    if (!enabled) return null;
    return this.enrolOrReject(req, country);
  }

  private async enrolOrReject(req: any, country: string | null): Promise<number | null> {
    const decision = decideInspectionEnrolment(await this.enrolmentInput(req, country));
    if (decision.outcome !== 'reject') {
      return decision.outcome === 'enrol' ? decision.policyVersion : null;
    }
    if (decision.code === INSPECTION_CODES.STRIPE_WINDOW) {
      const inspected = (await this.optInFlag(country)) ? true : undefined;
      throw cardWindowRejected(decision.code, decision.message, await this.stripeWindowFields(country, inspected));
    }
    throw inspectionRejected(decision.code, decision.message);
  }

  /** 1 when a new booking in this country would be inspected. Does not reject the listing. */
  async listingInspectionPolicy(country?: string | null, itemId?: string | null): Promise<number | null> {
    if (await this.optInFlag(country)) {
      return (await this.inspectionOptIn.stampsNewBooking(itemId)) ? 1 : null;
    }
    const enabled = await this.inspectionFlags.isEnabled(country);
    return enabled ? 1 : null;
  }

  async cardWindowFieldsFor(country?: string | null, latest?: string | null, inspected?: boolean) {
    const code = (country || '').trim();
    const rail = code ? await this.paymentRoutingService.resolveRailForCountry(code) : 'mobile_money';
    const reviewHours = await this.stripeReviewHours(code || null);
    const chargeAtPickupEnabled = await this.inspectionFlags.chargeAtPickupEnabled(code);
    const willInspect = inspected ?? (await this.inspectionFlags.isEnabled(code));
    return resolveCardPaymentPolicy({
      now: new Date(),
      rail: rail === 'stripe' ? 'stripe' : 'mobile_money',
      timezone: marketTimeZone(code) ?? 'Africa/Douala',
      latestCardEndAt: latest,
      reviewHours,
      chargeAtPickupEnabled,
      inspected: willInspect,
    });
  }

  private async enrolmentInput(req: any, country: string | null) {
    const windows = this.parseRentalSelectionWindows(req);
    const rail = country
      ? await this.paymentRoutingService.resolveRailForCountry(country)
      : 'mobile_money';
    const reviewHours = await this.stripeReviewHours(country);
    const card = await this.paymentPolicy(country, true, rail === 'stripe' ? 'stripe' : 'mobile_money', reviewHours);
    return {
      enabled: true,
      windowCount: windows.length,
      clientUserId: req.client?.user_id,
      businessUserId: req.rental_location_listing?.rental_item?.business?.user_id,
      rail,
      endAt: new Date(Math.max(...windows.map((window) => window.end.getTime()))),
      now: new Date(),
      reviewHours,
      allowSelfBooking: await this.inspectionFlags.allowSelfBooking(country),
      latest_card_end_at: card.latest_card_end_at,
    };
  }

  private async paymentPolicy(
    country: string | null,
    inspected: boolean,
    rail: 'stripe' | 'mobile_money',
    reviewHours: number
  ) {
    const chargeAtPickupEnabled = await this.inspectionFlags.chargeAtPickupEnabled(country);
    return resolveCardPaymentPolicy({
      rail,
      timezone: marketTimeZone(country) ?? 'Africa/Douala',
      reviewHours,
      chargeAtPickupEnabled,
      inspected,
    });
  }

  private stripeReviewHours(country: string | null): Promise<number> {
    return this.inspectionFlags.numberConfig(
      'rental_inspection_stripe_review_hours',
      country,
      DEFAULT_STRIPE_REVIEW_HOURS
    );
  }

  private async assertEnrolledStripeReviewWindow(
    bookingId: string,
    endAtIso: string,
    country: string | null
  ): Promise<void> {
    const policy = await this.readInspectionPolicy(bookingId);
    if (policy == null) return;
    const reviewHours = await this.stripeReviewHours(country);
    const card = await this.paymentPolicy(country, true, 'stripe', reviewHours);
    const input = {
      enabled: true,
      windowCount: 1,
      clientUserId: 'client',
      businessUserId: 'business',
      rail: 'stripe' as const,
      endAt: new Date(endAtIso),
      now: new Date(),
      reviewHours,
      latest_card_end_at: card.latest_card_end_at,
    };
    const decision = decideInspectionEnrolment(input);
    if (decision.outcome === 'reject') {
      const inspected = (await this.optInFlag(country)) ? true : undefined;
      throw cardWindowRejected(decision.code, decision.message, await this.stripeWindowFields(country, inspected));
    }
  }

  /** null = legacy. A failed read throws 503 so callers retry instead of guessing. */
  private async readInspectionPolicy(bookingId: string): Promise<number | null> {
    try {
      const result = await this.hasuraSystemService.executeQuery<{
        rental_bookings_by_pk: { inspection_policy_version?: number | null } | null;
      }>(
        `query InspectionPolicy($id: uuid!) {
          rental_bookings_by_pk(id: $id) { inspection_policy_version }
        }`,
        { id: bookingId }
      );
      return result.rental_bookings_by_pk?.inspection_policy_version ?? null;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger?.warn(`readInspectionPolicy ${bookingId}: ${error?.message ?? error}`);
      throw inspectionUnavailable();
    }
  }

  private async readInspectionStart(bookingId: string) {
    try {
      const result = await this.hasuraSystemService.executeQuery<{
        rental_bookings_by_pk: {
          inspection_policy_version?: number | null;
          pickup_ack_current?: boolean | null;
          pickup_accepted_version_id?: string | null;
          pickup_current_version_id?: string | null;
        } | null;
      }>(
        `query InspectionStart($id: uuid!) {
          rental_bookings_by_pk(id: $id) {
            inspection_policy_version
            pickup_ack_current
            pickup_accepted_version_id
            pickup_current_version_id
          }
        }`,
        { id: bookingId }
      );
      const row = result.rental_bookings_by_pk;
      if (!row) throw inspectionUnavailable();
      return {
        inspectionPolicyVersion: row.inspection_policy_version ?? null,
        pickupAckCurrent: !!row.pickup_ack_current,
        pickupAcceptedVersionId: row.pickup_accepted_version_id ?? null,
        pickupCurrentVersionId: row.pickup_current_version_id ?? null,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger?.warn(`readInspectionStart ${bookingId}: ${error?.message ?? error}`);
      throw inspectionUnavailable();
    }
  }

  async noteInspectionHandback(
    bookingId: string,
    actorId: string,
    notes = 'Physical handback recorded',
    changedByType: 'business' | 'system' = 'business',
    previous = 'active'
  ): Promise<void> {
    await this.logHistory(
      bookingId,
      'awaiting_return',
      previous,
      actorId,
      changedByType,
      notes
    );
  }

  /** Claim, then settle once. A dispute or a pending acknowledgment settles nothing. */
  async settleEnrolledRental(bookingId: string): Promise<void> {
    const booking = await this.fetchBooking(bookingId);
    const fields = booking ? await this.readEnrolledSettlement(bookingId) : null;
    if (!booking || !fields || fields.inspectionPolicyVersion == null) return;
    const gate = settlementGate({ ...fields, status: booking.status });
    if (fields.settlementAttention) return;
    if (gate.state === 'legacy' || gate.state === 'already' || gate.state === 'blocked') return;
    if (gate.state === 'ready' && !(await this.claimEnrolledSettlement(bookingId))) return;
    await this.finishEnrolledSettlement(booking, fields);
  }

  async sweepEnrolledSettlements(): Promise<number> {
    try {
      const result = await this.hasuraSystemService.executeQuery<{
        rental_bookings: Array<{ id: string }>;
      }>(
        `query DueInspectionSettlements {
          rental_bookings(where: {
            inspection_policy_version: { _is_null: false }
            return_handed_back_at: { _is_null: false }
            settlement_completed_at: { _is_null: true }
            settlement_attention: { _is_null: true }
            return_resolution: { _in: ["accepted", "admin_cleared"] }
            status: { _in: [active, awaiting_return, completed] }
          }) { id }
        }`,
        {}
      );
      const rows = result.rental_bookings ?? [];
      for (const row of rows) {
        try {
          await this.settleEnrolledRental(row.id);
        } catch (error: any) {
          this.logger?.warn(`enrolled settlement ${row.id}: ${error?.message ?? error}`);
        }
      }
      return rows.length;
    } catch (error: any) {
      this.logger?.warn(`enrolled settlement sweep skipped: ${error?.message ?? error}`);
      return 0;
    }
  }

  private async readEnrolledSettlement(bookingId: string): Promise<SettlementGateBooking | null> {
    try {
      const result = await this.hasuraSystemService.executeQuery<{
        rental_bookings_by_pk: {
          inspection_policy_version?: number | null;
          return_handed_back_at?: string | null;
          return_resolution?: string | null;
          settlement_claimed_at?: string | null;
          settlement_completed_at?: string | null;
          settlement_attention?: string | null;
          overtime_prompted_at?: string | null;
        } | null;
        rental_inspection_disputes: Array<{ id: string }>;
      }>(
        `query EnrolledSettlement($id: uuid!) {
          rental_bookings_by_pk(id: $id) {
            inspection_policy_version
            return_handed_back_at
            return_resolution
            settlement_claimed_at
            settlement_completed_at
            settlement_attention
            overtime_prompted_at
          }
          rental_inspection_disputes(
            where: { rental_booking_id: { _eq: $id }, status: { _in: ["open", "escalated"] } }
            limit: 1
          ) { id }
        }`,
        { id: bookingId }
      );
      const row = result.rental_bookings_by_pk;
      if (!row) return null;
      return {
        inspectionPolicyVersion: row.inspection_policy_version ?? null,
        returnHandedBackAt: row.return_handed_back_at ?? null,
        returnResolution: row.return_resolution ?? null,
        settlementClaimedAt: row.settlement_claimed_at ?? null,
        settlementCompletedAt: row.settlement_completed_at ?? null,
        openDispute: (result.rental_inspection_disputes?.length ?? 0) > 0,
        status: '',
        settlementAttention: row.settlement_attention ?? null,
        overtimePromptedAt: row.overtime_prompted_at ?? null,
      };
    } catch (error: any) {
      this.logger?.warn(`readEnrolledSettlement ${bookingId}: ${error?.message ?? error}`);
      return null;
    }
  }

  private async claimEnrolledSettlement(bookingId: string): Promise<boolean> {
    const result = await this.hasuraSystemService.executeMutation<{
      rental_claim_inspection_settlement?: Array<{ id: string }>;
    }>(
      `mutation ClaimInspectionSettlement($id: uuid!) {
        rental_claim_inspection_settlement(args: { p_booking_id: $id }) { id }
      }`,
      { id: bookingId }
    );
    return (result.rental_claim_inspection_settlement?.length ?? 0) > 0;
  }

  private async finishEnrolledSettlement(booking: any, fields: SettlementGateBooking): Promise<void> {
    const fresh = await this.fetchBooking(booking.id);
    if (!fresh) return;
    if (fresh.status === 'completed') {
      await this.stampSettlementCompleted(fresh.id);
      return;
    }
    if (fresh.status !== 'active' && fresh.status !== 'awaiting_return') return;
    const endedAt = (fresh.actual_end_at as string | null) || fields.returnHandedBackAt;
    if (!endedAt) return;
    const settlement = this.computeRentalSettlement(fresh, endedAt);
    const override = fresh.overtime_amount_override;
    if (override != null && override !== '' && Number.isFinite(Number(override))) {
      settlement.overtimeAmount = Math.max(0, Number(override));
    }
    if (fresh.payment_status === 'authorized') {
      await this.captureEnrolledStripe(fresh, settlement);
      return;
    }
    if (await this.overtimeNeedsMobileMoney(fresh, settlement.overtimeAmount)) {
      await this.pushEnrolledOvertimePrompt(fresh, settlement.overtimeAmount, fields.overtimePromptedAt);
      return;
    }
    const won = await this.runCompletion(fresh.id, fresh.status, null, 'system', () =>
      this.settleWalletHeldBooking(fresh, settlement)
    );
    if (won) await this.stampSettlementCompleted(fresh.id);
  }

  private async captureEnrolledStripe(booking: any, settlement: RentalReturnSettlement): Promise<void> {
    const decided = await this.decidedDamage(booking.id);
    const damage = damageCollectedOnAgree({
      paymentStatus: booking.payment_status ?? null,
      claimedAmount: booking.claimed_damage_amount ?? null,
      upheldAmount: decided.amount,
      decision: decided.decision,
    });
    const quote = priceEnrolledCapture({
      contract: settlement.contract,
      overtime: settlement.overtimeAmount,
      deposit: settlement.deposit,
      authorized: Number(booking.authorized_amount) || settlement.contract + settlement.deposit,
      damage,
      collectDamage: damage > 0,
    });
    const priced = { ...settlement, stripeCharge: quote.charge, overtimeAmount: quote.overtimeTaken };
    try {
      const won = await this.runCompletion(booking.id, booking.status, null, 'system', () =>
        this.settleStripeAuthorizedBooking(booking, priced)
      );
      if (won) await this.stampSettlementCompleted(booking.id);
    } catch (error: any) {
      if (!this.stripeAuthUncollectable(error)) throw error;
      await this.markSettlementAttention(booking.id, 'stripe_auth_expired');
      await this.logHistory(
        booking.id,
        booking.status,
        booking.status,
        null,
        'system',
        'Stripe authorization expired before capture. Flagged for an admin. No further automatic capture.'
      );
    }
  }

  private stripeAuthUncollectable(error: any): boolean {
    const text = `${error?.message ?? ''} ${JSON.stringify(error?.response ?? '')}`.toLowerCase();
    return /expired|canceled|cancelled|could not be captured|unexpected_state|cannot capture transaction in status/.test(
      text
    );
  }

  private async markSettlementAttention(bookingId: string, reason: string): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation FlagInspectionSettlement($id: uuid!, $reason: String!) {
        update_rental_bookings(
          where: { id: { _eq: $id }, settlement_attention: { _is_null: true } }
          _set: { settlement_attention: $reason }
        ) { affected_rows }
      }`,
      { id: bookingId, reason }
    );
  }

  /** Reuse a pending overtime prompt. Otherwise wait out the backoff before another push. */
  private async pushEnrolledOvertimePrompt(
    booking: any,
    overtimeAmount: number,
    promptedAt?: string | null
  ): Promise<void> {
    if (promptedAt && Date.now() - new Date(promptedAt).getTime() < OVERTIME_PROMPT_BACKOFF_MS) {
      return;
    }
    const pending = await this.mobilePaymentsDatabaseService.hasPendingRentalBookingPayment(
      booking.booking_number
    );
    if (pending) return;
    await this.patchBooking(booking.id, {
      overtime_amount: overtimeAmount,
      overtime_prompted_at: new Date().toISOString(),
    });
    await this.pushOvertimeCharge(booking, overtimeAmount);
  }

  private async decidedDamage(bookingId: string): Promise<{ decision: string | null; amount: number }> {
    const result = await this.hasuraSystemService.executeQuery<{
      rental_inspection_disputes: Array<{ decision: string | null; damage_amount: number | null }>;
    }>(
      `query DecidedInspectionDamage($id: uuid!) {
        rental_inspection_disputes(
          where: { rental_booking_id: { _eq: $id }, status: { _eq: "decided" } }
          order_by: { decided_at: desc }
          limit: 1
        ) { decision damage_amount }
      }`,
      { id: bookingId }
    );
    const row = result.rental_inspection_disputes?.[0];
    return {
      decision: row?.decision ?? null,
      amount: Math.max(0, Number(row?.damage_amount) || 0),
    };
  }

  async adjustEnrolledOvertime(
    bookingId: string,
    actorId: string,
    overtimeAmount: number,
    reason: string
  ): Promise<{ overtimeAmount: number; adjusted: true }> {
    if (!reason?.trim()) throw new HttpException('A reason is required', HttpStatus.BAD_REQUEST);
    if (!Number.isFinite(Number(overtimeAmount)) || Number(overtimeAmount) < 0) {
      throw new HttpException('Overtime amount must be zero or more', HttpStatus.BAD_REQUEST);
    }
    const booking = await this.fetchBooking(bookingId);
    if (!booking) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    if (booking.inspection_policy_version == null) {
      throw new HttpException('This booking does not use condition inspections', HttpStatus.CONFLICT);
    }
    const amount = Number(overtimeAmount);
    const adjusted = await this.hasuraSystemService.executeMutation<{
      update_rental_bookings?: { affected_rows: number };
    }>(
      `mutation AdjustEnrolledOvertime($id: uuid!, $amount: numeric!) {
        update_rental_bookings(
          where: { id: { _eq: $id }, settlement_claimed_at: { _is_null: true } }
          _set: { overtime_amount_override: $amount, updated_at: "now()" }
        ) { affected_rows }
      }`,
      { id: bookingId, amount }
    );
    if ((adjusted.update_rental_bookings?.affected_rows ?? 0) !== 1) {
      throw new HttpException('This rental is already settled', HttpStatus.CONFLICT);
    }
    await this.logHistory(
      bookingId,
      booking.status,
      booking.status,
      actorId,
      'system',
      `Support adjusted overtime to ${amount}. ${reason.trim()}`
    );
    return { overtimeAmount: amount, adjusted: true };
  }

  private async stampSettlementCompleted(bookingId: string): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation CompleteInspectionSettlement($id: uuid!, $at: timestamptz!) {
        update_rental_bookings(
          where: { id: { _eq: $id }, settlement_completed_at: { _is_null: true } }
          _set: { settlement_completed_at: $at }
        ) { affected_rows }
      }`,
      { id: bookingId, at: new Date().toISOString() }
    );
  }

  private async placeHoldForBooking(
    bookingId: string,
    clientId: string,
    total: number,
    currency: string
  ): Promise<'own' | 'other'> {
    const existing = await this.getHold(bookingId);
    if (existing?.status === 'active') return 'other';
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
    const attemptId = crypto.randomUUID();
    const hold = await this.accountsService.registerHoldIfNotExists({
      accountId: account.id,
      amount: total,
      memo: `Rental hold for booking ${bookingId}`,
      referenceId: attemptId,
      idempotencyKey: rentalLedgerKey(bookingId, `hold:${attemptId}`),
    });
    assertLedgerResult(hold, 'hold');
    const releaseOwnLedgerHold = () =>
      this.releaseRentalHold(bookingId, total, account.id, attemptId);
    try {
      if (existing?.status === 'cancelled') {
        const revived = await this.hasuraSystemService.executeMutation<{
          update_rental_holds: { affected_rows: number } | null;
        }>(Q.REACTIVATE_RENTAL_HOLD, {
          bookingId,
          amount: total,
          currency,
          attemptId,
        });
        if ((revived.update_rental_holds?.affected_rows ?? 0) > 0) return 'own';
        await releaseOwnLedgerHold();
        return 'other';
      }
      await this.hasuraSystemService.executeMutation(Q.INSERT_RENTAL_HOLD, {
        object: {
          rental_booking_id: bookingId,
          client_id: clientId,
          client_hold_amount: total,
          currency,
          status: 'active',
          ledger_attempt_id: attemptId,
        },
      });
      return 'own';
    } catch (error) {
      await releaseOwnLedgerHold();
      if (this.holdRowTakenBySomeoneElse(error)) return 'other';
      throw error;
    }
  }

  private holdRowTakenBySomeoneElse(error: unknown): boolean {
    const text = JSON.stringify(
      (error as { response?: unknown; message?: unknown })?.response ??
        (error as { message?: unknown })?.message ??
        error ??
        ''
    ).toLowerCase();
    return text.includes('uniqueness violation') || text.includes('duplicate key');
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
    await this.releaseRentalHold(
      bookingId,
      Number(h.client_hold_amount),
      account.id,
      this.holdAttemptId(h, bookingId)
    );
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_HOLD_STATUS, {
      bookingId,
      from: 'active',
      status: 'cancelled',
    });
  }

  private async getHold(bookingId: string) {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_holds: Array<{
        id: string;
        client_hold_amount: number;
        status: string;
        ledger_attempt_id?: string | null;
      }>;
    }>(
      `query H($bid: uuid!) { rental_holds(where: { rental_booking_id: { _eq: $bid } }) { id client_hold_amount status currency ledger_attempt_id } }`,
      { bid: bookingId }
    );
    return r.rental_holds?.[0] ?? null;
  }

  private async settleBooking(booking: any) {
    const h = await this.getHold(booking.id);
    if (!h || h.status === 'cancelled') {
      throw new HttpException('Hold not active', HttpStatus.BAD_REQUEST);
    }
    const accounts = await this.rentalSettlementAccounts(booking);
    await this.releaseRentalHold(
      booking.id,
      Number(h.client_hold_amount),
      accounts.clientAccountId,
      this.holdAttemptId(h, booking.id)
    );
    await this.postContractSettlement(booking, accounts, Number(booking.total_amount));
    if (h.status !== 'active') return;
    await this.hasuraSystemService.executeMutation(Q.UPDATE_RENTAL_HOLD_STATUS, {
      bookingId: booking.id,
      from: 'active',
      status: 'completed',
    });
  }

  private holdAttemptId(
    hold: { ledger_attempt_id?: string | null },
    bookingId: string
  ): string {
    return hold.ledger_attempt_id || bookingId;
  }

  private async releaseRentalHold(
    bookingId: string,
    amount: number,
    accountId: string,
    attemptId: string
  ): Promise<void> {
    const released = await this.accountsService.registerReleaseIfNotExists({
      accountId,
      amount,
      memo: `Release rental hold ${bookingId}`,
      referenceId: attemptId,
      idempotencyKey: rentalLedgerKey(bookingId, `hold:${attemptId}:release`),
    });
    assertLedgerResult(released, 'hold release');
  }

  private async rentalSettlementAccounts(booking: any): Promise<{
    clientAccountId: string;
    businessAccountId: string;
  }> {
    const clientAccount = await this.hasuraSystemService.getAccount(
      booking.client.user_id,
      booking.currency
    );
    const locId = booking.rental_location_listing?.business_location_id;
    if (!locId) {
      throw new HttpException('Location missing', HttpStatus.BAD_REQUEST);
    }
    const businessAccount =
      await this.hasuraSystemService.ensureAccountForBusinessLocation(locId);
    if (!businessAccount?.id || !clientAccount?.id) {
      throw new HttpException('Account missing', HttpStatus.BAD_REQUEST);
    }
    return {
      clientAccountId: clientAccount.id,
      businessAccountId: businessAccount.id,
    };
  }

  private async postContractSettlement(
    booking: any,
    accounts: { clientAccountId: string; businessAccountId: string },
    amount: number
  ): Promise<void> {
    const paid = await this.accountsService.registerTransaction({
      accountId: accounts.clientAccountId,
      amount,
      transactionType: 'payment',
      memo: `Rental payment ${booking.id}`,
      referenceId: booking.id,
      idempotencyKey: rentalLedgerKey(booking.id, 'contract:payment'),
    });
    assertLedgerResult(paid, 'contract payment');
    const credited = await this.accountsService.registerTransaction({
      accountId: accounts.businessAccountId,
      amount,
      transactionType: 'deposit',
      memo: `Rental proceeds ${booking.id}`,
      referenceId: booking.id,
      idempotencyKey: rentalLedgerKey(booking.id, 'contract:proceeds'),
    });
    assertLedgerResult(credited, 'contract proceeds');
  }

  private async patchBooking(id: string, _set: Record<string, unknown>) {
    await this.hasuraSystemService.executeMutation(
      `mutation PatchBooking($id: uuid!, $_set: rental_bookings_set_input!) {
        update_rental_bookings_by_pk(pk_columns: { id: $id }, _set: $_set) { id }
      }`,
      { id, _set }
    );
  }

  /** Resolved market for the search cache. Listings keep the uncanonical profile fallback. */
  async resolveSearchMarket(country?: string, state?: string): Promise<SearchMarket> {
    const profile = await this.profileSearchGeo(country, state);
    if (!profile.country && !profile.state) return marketFromQuery(undefined, undefined);
    return this.canonicalSearchMarket(profile.country, profile.state);
  }

  private async canonicalSearchMarket(country?: string, state?: string): Promise<SearchMarket> {
    const normalized = marketFromQuery(country, state);
    try {
      const stored = await this.storedSearchMarket(normalized.country, normalized.state);
      return marketFromQuery(stored.country ?? normalized.country, stored.state ?? normalized.state);
    } catch (error: any) {
      this.logger.warn(`rental market lookup failed: ${error?.message ?? 'unknown'}`);
      return { ...normalized, degraded: true };
    }
  }

  private async storedSearchMarket(country?: string, state?: string) {
    const response = await this.hasuraSystemService.executeQuery<{
      supported_country_states: Array<{ country_code: string; state_name: string; state_key?: string }>;
    }>(STORED_RENTAL_MARKET, { where: this.storedMarketWhere(country, state) });
    return pickStoredMarket(response.supported_country_states ?? [], country, state);
  }

  private storedMarketWhere(country?: string, state?: string): Record<string, unknown> {
    const stateKey = state ? geoStateKey(state) : '';
    return {
      ...(country ? { country_code: { _eq: country } } : {}),
      ...(stateKey ? { state_key: { _eq: stateKey } } : {}),
    };
  }

  private async resolveRentalCatalogGeo(queryCountry?: string, queryState?: string) {
    const geo = await this.profileSearchGeo(queryCountry, queryState);
    const filterMode = geo.country || geo.state ? 'specific' : 'supported_only';
    return { ...geo, filterMode } as {
      country?: string;
      state?: string;
      filterMode: 'specific' | 'supported_only';
    };
  }

  private async profileSearchGeo(queryCountry?: string, queryState?: string) {
    let country = queryCountry?.trim() || undefined;
    let state = queryState?.trim() || undefined;
    const primary = await this.primaryAddressCountry();
    if (!country && primary?.country) {
      country = primary.country;
      state = primary.state ?? state;
    }
    return { country, state };
  }

  private async primaryAddressCountry(): Promise<{ country?: string; state?: string } | null> {
    try {
      const user = await this.hasuraUserService.getUser();
      const addresses = user?.addresses;
      if (!addresses?.length) return null;
      const primary = addresses.find((row) => row.is_primary === true) ?? addresses[0];
      return { country: primary?.country, state: primary?.state ?? undefined };
    } catch {
      return null;
    }
  }

  private async resolveRentalListOrigin(
    query: Pick<ListPublicRentalListingsQuery, 'origin_lat' | 'origin_lng'>
  ): Promise<{ lat: number; lng: number } | null> {
    const queryOrigin = parseOptionalLatLng(query.origin_lat, query.origin_lng);
    // Client-supplied coordinates (browser/device) take priority for proximity UX.
    if (queryOrigin) {
      return queryOrigin;
    }
    try {
      const addr = await this.addressesService.getCurrentUserPrimaryAddress();
      if (!addr) {
        return null;
      }
      if (addr.latitude != null && addr.longitude != null) {
        return parseOptionalLatLng(
          Number(addr.latitude),
          Number(addr.longitude)
        );
      }
      const line = this.formatRentalAddressForGoogle(
        this.normalizeAddressForDistanceFmt(addr)
      );
      const geo = await this.googleDistanceService.geocode(line);
      return geo ? { lat: geo.latitude, lng: geo.longitude } : null;
    } catch (error: any) {
      this.logger.debug(
        `Rental list origin skipped: ${error?.message ?? error}`
      );
      return null;
    }
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
    return {
      _and: [
        base,
        { moderation_status: { _eq: 'approved' } },
        { is_active: { _eq: true } },
        { deleted_at: { _is_null: true } },
        { rental_item: { deleted_at: { _is_null: true }, is_active: { _eq: true } } },
        {
          rental_item: {
            business: { is_storefront_visible: { _eq: true } },
          },
        },
        {
          business_location: { is_active: { _eq: true } },
        },
      ],
    };
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
      copy.sort((a, b) => this.compareRentalByDistance(a, b) || compareListingId(a, b));
      return copy;
    }
    if (sort === 'cheapest') {
      copy.sort((a, b) => compareRentalPrice(a, b) || compareListingId(a, b));
      return copy;
    }
    if (sort === 'expensive') {
      copy.sort((a, b) => compareRentalPrice(b, a) || compareListingId(a, b));
      return copy;
    }
    copy.sort((a, b) => rentalListingUpdatedAtMs(b) - rentalListingUpdatedAtMs(a) || compareListingId(a, b));
    return copy;
  }

  private compareRentalByDistance(
    a: PublicRentalListingRow,
    b: PublicRentalListingRow
  ): number {
    const av = a.distance_value ?? Number.POSITIVE_INFINITY;
    const bv = b.distance_value ?? Number.POSITIVE_INFINITY;
    if (av !== bv) return av - bv;
    return rentalListingUpdatedAtMs(b) - rentalListingUpdatedAtMs(a) || compareListingId(a, b);
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

  private applyHaversineToRentalRows(
    rows: PublicRentalListingRow[],
    origin: { lat: number; lng: number } | null
  ): PublicRentalListingRow[] {
    if (!origin) return rows;
    return rows.map((row) => {
      const lat = row.business_location?.address?.latitude;
      const lng = row.business_location?.address?.longitude;
      if (
        lat == null ||
        lng == null ||
        !Number.isFinite(Number(lat)) ||
        !Number.isFinite(Number(lng))
      ) {
        return row;
      }
      const m = haversineMeters(
        origin.lat,
        origin.lng,
        Number(lat),
        Number(lng)
      );
      return {
        ...row,
        distance_value: m,
        distance_text: row.distance_text ?? formatDistanceMeters(m),
      };
    });
  }

  private async enrichRentalListingsWithDistance(
    rows: PublicRentalListingRow[],
    query: ListPublicRentalListingsQuery = {}
  ): Promise<PublicRentalListingRow[]> {
    if (rows.length === 0) return rows;
    try {
      const origin = await this.resolveRentalListOrigin(query);
      const clientOrigin = parseOptionalLatLng(
        query.origin_lat,
        query.origin_lng
      );
      let enriched = this.applyHaversineToRentalRows(rows, origin);
      enriched = await this.applyGoogleDistanceToRentalRows(
        enriched,
        origin,
        !!clientOrigin
      );
      return enriched;
    } catch (error: any) {
      this.logger.warn(
        `Rental distance enrichment skipped: ${error?.message ?? String(error)}`
      );
      return rows;
    }
  }

  private async applyGoogleDistanceToRentalRows(
    rows: PublicRentalListingRow[],
    origin: { lat: number; lng: number } | null,
    useResolvedOrigin = false
  ): Promise<PublicRentalListingRow[]> {
    if (rows.length === 0) return rows;
    const primary = await this.addressesService.getCurrentUserPrimaryAddress();
    let originId: string;
    let originFormatted: string;

    if (useResolvedOrigin && origin) {
      const { lat, lng } = origin;
      originId = `anon:${lat.toFixed(5)}:${lng.toFixed(5)}`;
      originFormatted = `${lat},${lng}`;
    } else if (primary) {
      originId = primary.id;
      originFormatted = this.formatRentalAddressForGoogle(
        this.normalizeAddressForDistanceFmt(primary)
      );
    } else if (origin) {
      const { lat, lng } = origin;
      originId = `anon:${lat.toFixed(5)}:${lng.toFixed(5)}`;
      originFormatted = `${lat},${lng}`;
    } else {
      return rows;
    }

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
      originId,
      originFormatted,
      destFormatted,
      { ttlSeconds: this.rentalDistanceCacheTtlSeconds() }
    );
    return this.attachDistanceToRentalRows(
      rows,
      matrix,
      destFormatted.map((d) => d.id)
    );
  }

  /** Confirmed booking that nobody started by end_at. Free cancel. */
  async cancelNoShowBooking(bookingId: string): Promise<boolean> {
    const booking = await this.fetchBooking(bookingId);
    if (!booking || !this.bookingIsNoShow(booking)) return false;
    const won = await this.claimNoShow(booking);
    if (!won) return false;
    return this.finishNoShow(booking);
  }

  unpaidReservationDue(booking: any, now = new Date()): boolean {
    return reservedUnpaidDue({
      now,
      startAt: new Date(booking?.start_at),
      timeZone: listingZoneFor(this.bookingCountry(booking)),
      policyVersion: booking?.inspection_policy_version ?? null,
      pickupInspectionPending: !!booking?.pickup_inspection_pending,
    });
  }

  private bookingIsNoShow(booking: any): boolean {
    return isNoShow({
      status: booking.status,
      actualStartAt: booking.actual_start_at,
      endAt: new Date(booking.end_at),
      now: new Date(),
    });
  }

  private async claimNoShow(booking: any): Promise<boolean> {
    return this.casBooking(booking.id, ['confirmed'], {
      status: 'cancelled',
      payment_status: 'cancelled',
      contract_expires_at: null,
    });
  }

  private async finishNoShow(booking: any): Promise<boolean> {
    try {
      await this.releaseNoShowFunds(booking);
    } catch (error) {
      await this.restoreConfirmed(booking);
      throw error;
    }
    await this.recordNoShow(booking);
    return true;
  }

  private async restoreConfirmed(booking: any): Promise<void> {
    await this.casBooking(booking.id, ['cancelled'], {
      status: 'confirmed',
      payment_status: booking.payment_status,
      contract_expires_at: booking.contract_expires_at ?? null,
    });
  }

  private async releaseNoShowFunds(booking: any): Promise<void> {
    await this.releaseFreeCancelFunds(booking);
    if (!(await this.momoWasCollected(booking))) return;
    this.logger?.log(`no-show ${booking.id}: Mobile Money returned to the renter wallet`);
  }

  private async momoWasCollected(booking: any): Promise<boolean> {
    const number = booking.booking_number as string | undefined;
    const check = this.mobilePaymentsDatabaseService?.hasSuccessfulRentalBookingPayment;
    if (!number || !check) return false;
    try {
      return await check.call(this.mobilePaymentsDatabaseService, number);
    } catch (error: any) {
      this.logger?.warn(`no-show momo ${booking.id}: ${error?.message ?? error}`);
      return false;
    }
  }

  private async recordNoShow(booking: any): Promise<void> {
    await this.logHistory(
      booking.id,
      'cancelled',
      'confirmed',
      null,
      'system',
      'No-show: not started by the rental end'
    );
    await this.deliveryPinService.clearPinForOrder(booking.id);
    await this.notifyNoShow(booking);
  }

  private async notifyNoShow(booking: any): Promise<void> {
    const item = booking.rental_location_listing?.rental_item?.name ?? 'Rental';
    const number = booking.booking_number ?? '';
    await this.pushNoShow(booking, booking.client?.user_id, item, number);
    await this.pushNoShow(booking, booking.business?.user_id, item, number);
  }

  private async pushNoShow(booking: any, userId: string | undefined, item: string, number: string) {
    if (!userId) return;
    try {
      await this.notificationsService.sendRentalNoShowNotice({
        recipientUserId: userId,
        rentalItemName: item,
        bookingId: booking.id,
        bookingNumber: number,
      });
    } catch (error: any) {
      this.logger?.warn(`notifyNoShow ${booking.id}: ${error?.message ?? error}`);
    }
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

function emptyStripeFields(): ListingCardWindow {
  const policy = resolveCardPaymentPolicy({
    rail: 'stripe',
    timezone: 'Africa/Douala',
    now: new Date(),
    reviewHours: DEFAULT_STRIPE_REVIEW_HOURS,
    inspected: true,
  });
  return { ...policy, inspection_enabled: true, card_auth_window_days: STRIPE_AUTH_WINDOW_DAYS };
}

export function readCardWindowFields(row: PublicRentalListingRow): ListingCardWindow | null {
  if (!row.payment_rail || row.momo_available == null || !row.timezone) return null;
  return {
    mode: row.mode ?? 'authorize_upfront',
    payment_rail: row.payment_rail,
    momo_available: row.momo_available,
    inspection_enabled: row.inspection_enabled === true,
    latest_card_end_at: row.latest_card_end_at ?? null,
    card_auth_window_days: row.card_auth_window_days ?? STRIPE_AUTH_WINDOW_DAYS,
    stripe_review_hours: row.stripe_review_hours ?? DEFAULT_STRIPE_REVIEW_HOURS,
    timezone: row.timezone,
  };
}
