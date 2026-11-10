import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { RentalSearchQueryDto, RentalSuggestQueryDto, RentalTopCategoriesQueryDto } from './dto/rental-search.dto';
import { availabilityForListing, parseSearchDateRange, type SearchDateRange } from './rental-search.dates';
import { type CapacityWindow } from './rental-capacity';
import { RentalsService, type PublicRentalListingRow } from './rentals.service';

const DAY_MS = 86_400_000;
const HORIZON_DAYS = 45;

export interface RentalSearchHit {
  listing: PublicRentalListingRow;
  available: boolean | null;
  nextAvailableDate: string | null;
  pricePerDay: number;
  totalForDates: number | null;
  dayCount: number | null;
}

@Injectable()
export class RentalSearchService {
  constructor(
    private readonly rentals: RentalsService,
    private readonly hasura: HasuraSystemService
  ) {}

  async search(query: RentalSearchQueryDto) {
    const range = this.dateRange(query.start_date, query.end_date);
    const rows = await this.rentals.collectPublicRentalListings({
      country_code: query.country_code,
      state: query.state,
      q: query.q,
      category_id: query.category_id,
      sort: query.sort,
      operation_mode: query.operation_mode,
      min_price: query.min_price,
      max_price: query.max_price,
    });
    const hits = await this.annotate(rows, range);
    hits.sort((a, b) => compareHits(a, b));
    return this.page(hits, query, range);
  }

  async suggest(query: RentalSuggestQueryDto) {
    const term = sanitizeTerm(query.q);
    if (term.length < 2) return [];
    const res = await this.hasura.executeQuery<SuggestRows>(SUGGEST, {
      pat: `%${term}%`,
    });
    return rankSuggestions(res, term, query.country_code, query.state);
  }

  async topCategories(query: RentalTopCategoriesQueryDto) {
    const take = Math.min(12, Math.max(1, Number(query.limit) || 6));
    const [listings, bookings] = await Promise.all([
      this.rentals.collectPublicRentalListings({
        country_code: query.country_code,
        state: query.state,
      }),
      this.bookingCategories(query),
    ]);
    return rankCategories(listings, bookings).slice(0, take);
  }

  private dateRange(start?: string, end?: string): SearchDateRange | null {
    try {
      return parseSearchDateRange(start, end);
    } catch {
      throw new HttpException('start_date and end_date must be a range of 1 to 30 days', HttpStatus.BAD_REQUEST);
    }
  }

  private async annotate(rows: PublicRentalListingRow[], range: SearchDateRange | null) {
    const windows = range ? await this.loadWindows(rows, range) : new Map<string, CapacityWindow[]>();
    const now = Date.now();
    return rows.map((listing, catalogIndex) => this.hit(listing, catalogIndex, windows, range, now));
  }

  private hit(
    listing: PublicRentalListingRow,
    catalogIndex: number,
    windows: Map<string, CapacityWindow[]>,
    range: SearchDateRange | null,
    now: number
  ): RentalSearchHit & { catalogIndex: number } {
    const pricePerDay = Number(listing.base_price_per_day) || 0;
    if (!range) {
      return { listing, available: null, nextAvailableDate: null, pricePerDay, totalForDates: null, dayCount: null, catalogIndex };
    }
    const availability = availabilityForListing({
      unitsAvailable: listing.units_available,
      windows: windows.get(listing.id) ?? [],
      weekly: listing.weekly_availability,
      range,
      nowMs: now,
      pricePerDay,
    });
    return { listing, pricePerDay, dayCount: range.dayCount, catalogIndex, ...availability };
  }

  private async loadWindows(rows: PublicRentalListingRow[], range: SearchDateRange) {
    const ids = rows.map((row) => row.id);
    const grouped = new Map<string, CapacityWindow[]>();
    if (!ids.length) return grouped;
    const res = await this.hasura.executeQuery<WindowRows>(WINDOWS, {
      ids,
      start: new Date(range.startMs).toISOString(),
      end: new Date(range.startMs + (HORIZON_DAYS + range.dayCount) * DAY_MS).toISOString(),
      now: new Date().toISOString(),
    });
    for (const row of res.rental_booking_windows ?? []) {
      const id = row.rental_booking?.rental_location_listing_id;
      if (!id) continue;
      const list = grouped.get(id) ?? [];
      list.push({
        startMs: new Date(row.start_at).getTime(),
        endMs: new Date(row.end_at).getTime(),
        units: Math.max(1, Number(row.rental_booking?.units_booked) || 1),
      });
      grouped.set(id, list);
    }
    return grouped;
  }

  private async bookingCategories(query: RentalTopCategoriesQueryDto) {
    const res = await this.hasura.executeQuery<BookingRows>(BOOKING_CATEGORIES, {
      where: bookingWhere(query),
    });
    return res.rental_bookings ?? [];
  }

  private page(hits: Array<RentalSearchHit & { catalogIndex: number }>, query: RentalSearchQueryDto, range: SearchDateRange | null) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const start = (page - 1) * limit;
    const slice = hits.slice(start, start + limit).map(stripCatalogIndex);
    return {
      listings: slice,
      total: hits.length,
      page,
      limit,
      availableCount: hits.filter((hit) => hit.available === true).length,
      dates: range
        ? { startDate: range.startDate, endDate: range.endDate, dayCount: range.dayCount }
        : null,
    };
  }
}

function stripCatalogIndex(hit: RentalSearchHit & { catalogIndex: number }): RentalSearchHit {
  return {
    listing: hit.listing,
    available: hit.available,
    nextAvailableDate: hit.nextAvailableDate,
    pricePerDay: hit.pricePerDay,
    totalForDates: hit.totalForDates,
    dayCount: hit.dayCount,
  };
}

function compareHits(a: RentalSearchHit & { catalogIndex: number }, b: RentalSearchHit & { catalogIndex: number }): number {
  const rank = (hit: RentalSearchHit) => (hit.available === false ? 1 : 0);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a.available === false && b.available === false) {
    const an = a.nextAvailableDate ?? '9999-99-99';
    const bn = b.nextAvailableDate ?? '9999-99-99';
    if (an !== bn) return an < bn ? -1 : 1;
  }
  return a.catalogIndex - b.catalogIndex;
}

function sanitizeTerm(value?: string): string {
  return (value ?? '').trim().toLowerCase().replace(/[%_\\]/g, '').slice(0, 80);
}

function rankSuggestions(
  res: SuggestRows,
  term: string,
  country?: string,
  state?: string
) {
  const categories = (res.rental_categories ?? []).map((row) => ({
    kind: 'category' as const,
    id: row.id,
    label: row.name,
    subtitle: null as string | null,
  }));
  const titles = (res.rental_items ?? [])
    .filter((item) => listingInMarket(item, country, state))
    .map((item) => ({
      kind: 'listing' as const,
      id: item.rental_location_listings[0].id,
      label: item.name,
      subtitle: item.rental_category?.name ?? null,
      starts: item.name.toLowerCase().startsWith(term),
    }))
    .sort((a, b) => Number(b.starts) - Number(a.starts))
    .map((row) => ({
      kind: row.kind,
      id: row.id,
      label: row.label,
      subtitle: row.subtitle,
    }));
  return [...categories, ...titles].slice(0, 8);
}

function listingInMarket(
  item: SuggestRows['rental_items'][number],
  country?: string,
  state?: string
): boolean {
  const listing = item.rental_location_listings?.[0];
  if (!listing) return false;
  const address = listing.business_location?.address;
  if (country && !sameText(address?.country, country)) return false;
  if (state && !sameText(address?.state, state)) return false;
  return true;
}

function sameText(left?: string | null, right?: string | null): boolean {
  return (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase();
}

function bookingWhere(query: RentalTopCategoriesQueryDto): Record<string, unknown> {
  const since = new Date(Date.now() - 180 * DAY_MS).toISOString();
  const address: Record<string, unknown> = {};
  if (query.country_code?.trim()) address.country = { _eq: query.country_code.trim() };
  if (query.state?.trim()) address.state = { _eq: query.state.trim() };
  const where: Record<string, unknown> = {
    created_at: { _gte: since },
    status: { _nin: ['cancelled'] },
  };
  if (Object.keys(address).length) {
    where.rental_location_listing = { business_location: { address } };
  }
  return where;
}

function rankCategories(
  listings: PublicRentalListingRow[],
  bookings: BookingRows['rental_bookings']
) {
  const byId = new Map<string, { id: string; name: string; slug?: string; bookings: number; listings: number }>();
  for (const row of listings) {
    const category = row.rental_item?.rental_category;
    if (!category?.id) continue;
    const current = byId.get(category.id) ?? { id: category.id, name: category.name, bookings: 0, listings: 0 };
    current.listings += 1;
    byId.set(category.id, current);
  }
  for (const row of bookings) {
    const category = row.rental_location_listing?.rental_item?.rental_category;
    if (!category?.id) continue;
    const current = byId.get(category.id) ?? { id: category.id, name: category.name, bookings: 0, listings: 0 };
    current.bookings += 1;
    byId.set(category.id, current);
  }
  return [...byId.values()]
    .sort((a, b) => b.bookings - a.bookings || b.listings - a.listings || a.name.localeCompare(b.name))
    .map((row) => ({
      id: row.id,
      name: row.name,
      bookingCount: row.bookings,
      listingCount: row.listings,
    }));
}

interface WindowRows {
  rental_booking_windows: Array<{
    start_at: string;
    end_at: string;
    rental_booking?: {
      rental_location_listing_id?: string;
      units_booked?: number | null;
    } | null;
  }>;
}

interface SuggestRows {
  rental_categories: Array<{ id: string; name: string }>;
  rental_items: Array<{
    id: string;
    name: string;
    rental_category?: { id: string; name: string } | null;
    rental_location_listings: Array<{
      id: string;
      business_location?: { address?: { country?: string | null; state?: string | null } | null } | null;
    }>;
  }>;
}

interface BookingRows {
  rental_bookings: Array<{
    rental_location_listing?: {
      rental_item?: { rental_category?: { id: string; name: string } | null } | null;
    } | null;
  }>;
}

const WINDOWS = `
  query RentalSearchWindows($ids: [uuid!]!, $start: timestamptz!, $end: timestamptz!, $now: timestamptz!) {
    rental_booking_windows(
      where: {
        start_at: { _lt: $end }
        end_at: { _gt: $start }
        rental_booking: {
          rental_location_listing_id: { _in: $ids }
          _or: [
            { status: { _in: [reserved, confirmed, active, awaiting_return] } }
            { _and: [{ status: { _eq: proposed } }, { contract_expires_at: { _gt: $now } }] }
          ]
        }
      }
    ) {
      start_at
      end_at
      rental_booking { rental_location_listing_id units_booked }
    }
  }
`;

const SUGGEST = `
  query RentalSuggest($pat: String!) {
    rental_categories(where: { is_active: { _eq: true }, name: { _ilike: $pat } }, limit: 4, order_by: { name: asc }) {
      id
      name
    }
    rental_items(
      where: { is_active: { _eq: true }, deleted_at: { _is_null: true }, name: { _ilike: $pat } }
      limit: 8
      order_by: { name: asc }
    ) {
      id
      name
      rental_category { id name }
      rental_location_listings(
        where: { is_active: { _eq: true }, deleted_at: { _is_null: true }, moderation_status: { _eq: approved } }
        limit: 1
      ) {
        id
        business_location { address { country state } }
      }
    }
  }
`;

const BOOKING_CATEGORIES = `
  query RentalCategoryUsage($where: rental_bookings_bool_exp!) {
    rental_bookings(where: $where, limit: 2000) {
      rental_location_listing { rental_item { rental_category { id name } } }
    }
  }
`;
