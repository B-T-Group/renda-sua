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

export interface RankConfig {
  w: number;
  minSample: number;
  start: number;
  full: number;
}

/**
 * Weight stays in [0, 0.9], the sample is at least 1, and 0 ≤ start < full ≤ 1.
 * A null or out-of-range value falls back to the seeded default.
 */
function finiteAtLeast(value: number | null, min: number, max: number, maxInclusive: boolean): value is number {
  if (value == null || !Number.isFinite(value) || value < min) return false;
  return maxInclusive ? value <= max : value < max;
}

export function clampRankConfig(input: {
  w: number | null;
  minSample: number | null;
  start: number | null;
  full: number | null;
}): RankConfig & { warnings: string[] } {
  const warnings: string[] = [];
  let w = input.w;
  if (!finiteAtLeast(w, 0, 0.9, true)) {
    warnings.push('weight');
    w = RANK_DEFAULTS.weight;
  }
  let minSample = input.minSample;
  if (!finiteAtLeast(minSample, 1, Number.MAX_SAFE_INTEGER, true)) {
    warnings.push('min_sample');
    minSample = RANK_DEFAULTS.minSample;
  } else {
    minSample = Math.floor(minSample);
  }
  let start = input.start;
  if (!finiteAtLeast(start, 0, 1, false)) {
    warnings.push('start');
    start = RANK_DEFAULTS.start;
  }
  let full = input.full;
  if (!finiteAtLeast(full, 0, 1, true) || full <= start) {
    warnings.push('full');
    full = RANK_DEFAULTS.full;
    if (full <= start) start = RANK_DEFAULTS.start;
  }
  return { w, minSample, start, full, warnings };
}

/** Smoothed decline rate. Below the sample, or with weight 0, the listing stays put. */
export function rankMultiplier(input: RankInput): number {
  const w = Number.isFinite(input.w) ? Math.min(0.9, Math.max(0, input.w)) : 0;
  if (w === 0 || input.n < input.minSample) return 1;
  const span = input.full - input.start;
  if (!(span > 0)) return 1;
  const rate = Math.max(input.p, 0.05);
  const r = (input.d + 10 * rate) / (input.n + 10);
  const t = Math.min(1, Math.max(0, (r - input.start) / span));
  return Math.max(0.1, 1 - w * t);
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
