import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { RentalInspectionFlags } from '../inspection/rental-inspection-flags.service';
import {
  RANK_DEFAULTS,
  RANK_FULL_KEY,
  RANK_MIN_SAMPLE_KEY,
  RANK_START_KEY,
  RANK_WEIGHT_KEY,
  platformRate,
  rankMultiplier,
} from './decline-ranking.policy';
import { RANK_SNAPSHOT } from './decline-ranking.queries';

const CACHE_MS = 60_000;
const KEYS = [RANK_WEIGHT_KEY, RANK_MIN_SAMPLE_KEY, RANK_START_KEY, RANK_FULL_KEY];

interface Snapshot {
  application_configurations: Array<{ config_key: string; number_value?: number | string | null }>;
  rental_condition_decline_counts_90d: Array<{ party_id: string; decline_count: number }>;
  rental_business_pickup_reach_90d: Array<{ business_id: string; pickups_reached: number }>;
}

interface BusinessStat {
  n: number;
  d: number;
}

@Injectable()
export class DeclineRankingService {
  private cache: { at: number; multipliers: Map<string, number> } | null = null;

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly flags: RentalInspectionFlags
  ) {}

  async multipliersFor(businessIds: string[]): Promise<Map<string, number>> {
    const all = await this.cached();
    return this.pick(businessIds, all);
  }

  clearCache(): void {
    this.cache = null;
  }

  private async cached(): Promise<Map<string, number>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.multipliers;
    const multipliers = await this.load();
    this.cache = { at: Date.now(), multipliers };
    return multipliers;
  }

  private async load(): Promise<Map<string, number>> {
    try {
      if (!(await this.flags.declineRankingEnabled())) return new Map();
      return this.scores(await this.hasura.executeQuery<Snapshot>(RANK_SNAPSHOT, { keys: KEYS }));
    } catch (error: any) {
      void error;
      return new Map();
    }
  }

  private scores(snapshot: Snapshot): Map<string, number> {
    const stats = this.stats(snapshot);
    const config = this.config(snapshot.application_configurations ?? []);
    const p = platformRate([...stats.values()]);
    const multipliers = new Map<string, number>();
    for (const [id, stat] of stats) multipliers.set(id, rankMultiplier({ ...stat, p, ...config }));
    return multipliers;
  }

  private stats(snapshot: Snapshot): Map<string, BusinessStat> {
    const stats = new Map<string, BusinessStat>();
    for (const row of snapshot.rental_business_pickup_reach_90d ?? []) {
      stats.set(row.business_id, { n: row.pickups_reached ?? 0, d: 0 });
    }
    for (const row of snapshot.rental_condition_decline_counts_90d ?? []) {
      const current = stats.get(row.party_id) ?? { n: 0, d: 0 };
      stats.set(row.party_id, { n: current.n, d: row.decline_count ?? 0 });
    }
    return stats;
  }

  private config(rows: Snapshot['application_configurations']) {
    const value = (key: string, fallback: number) => {
      const raw = Number(rows.find((row) => row.config_key === key)?.number_value);
      return Number.isFinite(raw) ? raw : fallback;
    };
    return {
      w: value(RANK_WEIGHT_KEY, RANK_DEFAULTS.weight),
      minSample: value(RANK_MIN_SAMPLE_KEY, RANK_DEFAULTS.minSample),
      start: value(RANK_START_KEY, RANK_DEFAULTS.start),
      full: value(RANK_FULL_KEY, RANK_DEFAULTS.full),
    };
  }

  private pick(ids: string[], all: Map<string, number>): Map<string, number> {
    const out = new Map<string, number>();
    for (const id of ids) {
      const value = all.get(id);
      if (value != null && value !== 1) out.set(id, value);
    }
    return out;
  }
}
