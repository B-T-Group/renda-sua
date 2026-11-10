import type { RentalListingRow } from '../types/rentals';
import { apiRequest } from './apiClient';
import { publicApiGet } from './publicApiClient';

type Init = { signal?: AbortSignal };

export interface RentalSearchHit {
  listing: RentalListingRow;
  available: boolean | null;
  nextAvailableDate: string | null;
  pricePerDay: number;
  totalForDates: number | null;
  dayCount: number | null;
}

export interface RentalSearchPage {
  listings: RentalSearchHit[];
  total: number;
  page: number;
  limit: number;
  availableCount: number;
  dates: { startDate: string; endDate: string; dayCount: number } | null;
}

export interface RentalSuggestion {
  kind: 'category' | 'listing';
  id: string;
  label: string;
  subtitle: string | null;
}

export interface RentalTopCategory {
  id: string;
  name: string;
  bookingCount: number;
  listingCount: number;
}

export interface RentalSearchParams {
  q?: string;
  country_code?: string;
  state?: string;
  category_id?: string;
  sort?: 'relevance' | 'newest' | 'cheapest' | 'expensive';
  operation_mode?: 'take_home' | 'business_operated';
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

function searchParams(params: RentalSearchParams): Record<string, string | number | undefined> {
  return {
    q: params.q?.trim() || undefined,
    country_code: params.country_code,
    state: params.state,
    category_id: params.category_id,
    sort: params.sort,
    operation_mode: params.operation_mode,
    start_date: params.start_date,
    end_date: params.end_date,
    page: params.page,
    limit: params.limit,
  };
}

export async function searchRentals(
  params: RentalSearchParams,
  init?: Init
): Promise<RentalSearchPage> {
  const res = await publicApiGet<{ success: boolean; data: RentalSearchPage }>(
    '/rentals/search',
    searchParams(params),
    init
  );
  return (
    res.data ?? {
      listings: [],
      total: 0,
      page: 1,
      limit: 20,
      availableCount: 0,
      dates: null,
    }
  );
}

export async function suggestRentals(
  params: { q: string; country_code?: string; state?: string },
  init?: Init
): Promise<RentalSuggestion[]> {
  const res = await publicApiGet<{ success: boolean; data: { suggestions: RentalSuggestion[] } }>(
    '/rentals/suggestions',
    params,
    init
  );
  return res.data?.suggestions ?? [];
}

export async function topRentalCategories(
  params: { country_code?: string; state?: string; limit?: number },
  init?: Init
): Promise<RentalTopCategory[]> {
  const res = await publicApiGet<{ success: boolean; data: { categories: RentalTopCategory[] } }>(
    '/rentals/categories/top',
    params,
    init
  );
  return res.data?.categories ?? [];
}

export async function subscribeRentalAvailability(body: {
  q?: string;
  category_id?: string;
  country_code?: string;
  state?: string;
  start_date: string;
  end_date: string;
}): Promise<{ id: string }> {
  const res = await apiRequest<{ success: boolean; data: { subscription: { id: string } } }>(
    '/rentals/availability-subscriptions',
    { method: 'POST', body: JSON.stringify(body) }
  );
  return res.data.subscription;
}
