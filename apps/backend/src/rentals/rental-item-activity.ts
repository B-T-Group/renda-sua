export type RentalItemActivityScope = 'all' | 'upcoming' | 'past';

export type ItemActivityStatsQuery = {
  rental_items_by_pk: { id: string; name: string; currency?: string | null } | null;
  completed: {
    aggregate: {
      count: number;
      sum: { total_amount: number | null; overtime_amount: number | null } | null;
    } | null;
  };
  currentlyOut: { aggregate: { count: number } | null };
  upcoming: { aggregate: { count: number } | null };
  openRequests: { aggregate: { count: number } | null };
  lastCompleted: Array<{ actual_end_at?: string | null; end_at?: string | null }>;
  nextStart: Array<{ start_at?: string | null }>;
};

export const ACTIVITY_UPCOMING_STATUSES = [
  'proposed',
  'reserved',
  'confirmed',
  'active',
  'awaiting_return',
] as const;

export const ACTIVITY_PAST_STATUSES = ['completed', 'cancelled'] as const;

export function normalizeActivityScope(
  scope?: string | null
): RentalItemActivityScope {
  const value = (scope ?? '').trim().toLowerCase();
  if (value === 'upcoming' || value === 'past' || value === 'all') return value;
  return 'all';
}

export function activityStatusesForScope(
  scope: RentalItemActivityScope
): string[] | null {
  if (scope === 'upcoming') return [...ACTIVITY_UPCOMING_STATUSES];
  if (scope === 'past') return [...ACTIVITY_PAST_STATUSES];
  return null;
}

export function activityOrderForScope(
  scope: RentalItemActivityScope
): Array<Record<string, 'asc' | 'desc'>> {
  if (scope === 'upcoming') return [{ start_at: 'asc' }];
  return [{ start_at: 'desc' }];
}

export function activityPageLimit(page?: number, limit?: number) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
}

export function earnedFromCompletedSums(
  totalAmount: number | null | undefined,
  overtimeAmount: number | null | undefined
): number {
  return Number(totalAmount ?? 0) + Number(overtimeAmount ?? 0);
}

export function defaultActivityScope(stats: {
  upcoming: number;
  timesRented: number;
}): RentalItemActivityScope {
  if (stats.upcoming > 0) return 'upcoming';
  if (stats.timesRented > 0) return 'past';
  return 'all';
}
