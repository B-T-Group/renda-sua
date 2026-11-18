import { readFileSync } from 'fs';
import { join } from 'path';
import { clampRankConfig, exclusionAllowed, platformRate, rankMultiplier } from './decline-ranking.policy';

const base = { w: 0.3, start: 0.1, full: 0.4, minSample: 10 };

describe('decline ranking formula', () => {
  it('does nothing below the sample, at the start, and when the weight is zero', () => {
    expect(rankMultiplier({ ...base, n: 9, d: 9, p: 0.5 })).toBe(1);
    expect(rankMultiplier({ ...base, n: 10, d: 1, p: 0.1 })).toBe(1);
    expect(rankMultiplier({ ...base, n: 100, d: 100, p: 0.5, w: 0 })).toBe(1);
  });

  it('falls back when weight, sample, or the rate window is missing or out of range', () => {
    const bad = clampRankConfig({ w: 1, minSample: 0, start: null, full: 0.4 });
    expect(bad.warnings).toEqual(['weight', 'min_sample', 'start']);
    expect(bad.w).toBe(0.3);
    expect(bad.minSample).toBe(10);
    expect(bad.start).toBe(0.1);
    const swapped = clampRankConfig({ w: 0.9, minSample: 2.8, start: 0.5, full: 0.4 });
    expect(swapped.w).toBe(0.9);
    expect(swapped.minSample).toBe(2);
    expect(swapped.start).toBe(0.1);
    expect(swapped.full).toBe(0.4);
  });

  it('ramps between the start and the full rate, then stays capped', () => {
    const around = rankMultiplier({ ...base, n: 10, d: 2, p: 0.1 });
    expect(around).toBeCloseTo(0.95, 5);
    expect(rankMultiplier({ ...base, n: 10, d: 7, p: 0.1 })).toBeCloseTo(0.7, 5);
    expect(rankMultiplier({ ...base, n: 10, d: 20, p: 0.1 })).toBeCloseTo(0.7, 5);
  });

  it('floors the platform rate at 0.05', () => {
    expect(platformRate([{ n: 0, d: 0 }])).toBe(0.05);
    expect(platformRate([{ n: 10, d: 0 }])).toBe(0.05);
    const floored = rankMultiplier({ ...base, n: 90, d: 10, p: 0 });
    expect(floored).toBeLessThan(1);
    expect(floored).toBeCloseTo(1 - 0.3 * (0.005 / 0.3), 5);
  });
});

describe('decline exclusion rules', () => {
  it('lets support and admin mark a decline, and nobody else', () => {
    expect(exclusionAllowed(['support'])).toBe(true);
    expect(exclusionAllowed(['superuser'])).toBe(true);
    expect(exclusionAllowed(['order_manager'])).toBe(true);
    expect(exclusionAllowed(['moderator'])).toBe(false);
    expect(exclusionAllowed([])).toBe(false);
  });

  it('keeps excluded declines on the renter count and drops them from the business count', () => {
    const sql = readFileSync(
      join(__dirname, '../../../../hasura/migrations/Rendasua/20261118150000_rentals_decline_ranking/up.sql'),
      'utf8'
    );
    const view = sql.slice(sql.indexOf('CREATE OR REPLACE VIEW'));
    const [renter, business] = view.split('UNION ALL');
    expect(renter).not.toContain('excluded_at');
    expect(business).toContain('d.excluded_at IS NULL');
    expect(renter).toContain('count(DISTINCT d.rental_booking_id)');
    expect(business).toContain('count(DISTINCT d.rental_booking_id)');
    expect(sql).toContain("'rentals_decline_ranking_enabled'");
    expect(sql).toContain('false');
    const down = readFileSync(
      join(__dirname, '../../../../hasura/migrations/Rendasua/20261118150000_rentals_decline_ranking/down.sql'),
      'utf8'
    );
    expect(down).toContain("status = 'inactive'");
    expect(down).not.toContain('DELETE FROM');
    const guards = readFileSync(
      join(__dirname, '../../../../hasura/migrations/Rendasua/20261118180000_rentals_decline_ranking_guards/up.sql'),
      'utf8'
    );
    expect(guards).toContain('rentals_decline_rank_weight_range');
    expect(guards).toContain('number_value <= 0.9');
  });
});
