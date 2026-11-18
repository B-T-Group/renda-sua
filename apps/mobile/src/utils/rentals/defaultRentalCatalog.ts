import type { RentalSearchParams } from '../../services/rentalSearchApi';
import type { RentalDateRange } from './rentalSearchDates';

export const DEFAULT_RENTAL_PAGE_SIZE = 20;

export function defaultCatalogParams(input: {
  country?: string;
  state?: string;
  query: string;
  categoryId: string | null;
  dates: RentalDateRange | null;
  sort: string;
  page: number;
}): RentalSearchParams {
  const term = input.query.trim();
  return {
    q: term || undefined,
    country_code: input.country,
    state: input.state,
    category_id: input.categoryId ?? undefined,
    sort: input.sort as RentalSearchParams['sort'],
    start_date: input.dates?.startDate,
    end_date: input.dates?.endDate,
    page: input.page,
    limit: DEFAULT_RENTAL_PAGE_SIZE,
  };
}

export function mergeSearchHits<T extends { listing: { id: string } }>(
  previous: T[],
  next: T[],
  page: number
): T[] {
  if (page <= 1) return next;
  const seen = new Set(previous.map((hit) => hit.listing.id));
  const added: T[] = [];
  for (const hit of next) {
    if (seen.has(hit.listing.id)) continue;
    seen.add(hit.listing.id);
    added.push(hit);
  }
  return [...previous, ...added];
}
