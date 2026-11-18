export const DECLINE_RANKING_FLAG = 'rentals_decline_ranking_enabled';
export const RANK_WEIGHT_KEY = 'rentals_decline_rank_weight';
export const RANK_MIN_SAMPLE_KEY = 'rentals_decline_rank_min_sample';
export const RANK_START_KEY = 'rentals_decline_rank_start';
export const RANK_FULL_KEY = 'rentals_decline_rank_full';

export const RANK_DEFAULTS = {
  weight: 0.3,
  minSample: 10,
  start: 0.1,
  full: 0.4,
};

const SUPPORT_ROLES = new Set(['superuser', 'support', 'order_manager']);

export interface RankInput {
  n: number;
  d: number;
  p: number;
  w: number;
  start: number;
  full: number;
  minSample: number;
}

/** Smoothed decline rate. Below the sample, or with weight 0, the listing stays put. */
export function rankMultiplier(input: RankInput): number {
  if (input.w === 0 || input.n < input.minSample) return 1;
  const span = input.full - input.start;
  if (span <= 0) return 1;
  const rate = Math.max(input.p, 0.05);
  const r = (input.d + 10 * rate) / (input.n + 10);
  const t = Math.min(1, Math.max(0, (r - input.start) / span));
  return 1 - input.w * t;
}

/** Platform decline rate. Empty traffic stays on the 0.05 floor. */
export function platformRate(rows: Array<{ n: number; d: number }>): number {
  const totals = rows.reduce((sum, row) => ({ n: sum.n + row.n, d: sum.d + row.d }), { n: 0, d: 0 });
  if (totals.n <= 0) return 0.05;
  return Math.max(0.05, totals.d / totals.n);
}

export function exclusionAllowed(roles: string[]): boolean {
  return roles.some((role) => SUPPORT_ROLES.has(role));
}
