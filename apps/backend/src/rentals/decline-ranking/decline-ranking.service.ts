import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { RentalInspectionFlags } from '../inspection/rental-inspection-flags.service';
import {
  RANK_FULL_KEY,
  RANK_MIN_SAMPLE_KEY,
  RANK_START_KEY,
  RANK_WEIGHT_KEY,
  clampRankConfig,
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
  private readonly logger = new Logger(DeclineRankingService.name);
  /** One process, 60 seconds. The platform rate is pooled across countries. */
  private cache: { at: number; multipliers: Map<string, number> } | null = null;

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly flags: RentalInspectionFlags
  ) {}

  async multipliersFor(businessIds: string[], countryCode?: string | null): Promise<Map<string, number>> {
    const all = await this.cached(countryCode);
    return this.pick(businessIds, all);
  }

  clearCache(): void {
    this.cache = null;
  }

  private async cached(countryCode?: string | null): Promise<Map<string, number>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.multipliers;
    const multipliers = await this.load(countryCode);
    this.cache = { at: Date.now(), multipliers };
    return multipliers;
  }

  private async load(countryCode?: string | null): Promise<Map<string, number>> {
    try {
      if (!(await this.flags.declineRankingEnabled(countryCode))) return new Map();
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
      const declines = row.decline_count ?? 0;
      stats.set(row.party_id, { n: current.n, d: Math.min(declines, current.n) });
    }
    return stats;
  }

  private config(rows: Snapshot['application_configurations']) {
    const value = (key: string): number | null => {
      const raw = rows.find((row) => row.config_key === key)?.number_value;
      if (raw == null) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const clamped = clampRankConfig({
      w: value(RANK_WEIGHT_KEY),
      minSample: value(RANK_MIN_SAMPLE_KEY),
      start: value(RANK_START_KEY),
      full: value(RANK_FULL_KEY),
    });
    if (clamped.warnings.length > 0) {
      this.logger.warn(`decline ranking config fell back to defaults: ${clamped.warnings.join(', ')}`);
    }
    return clamped;
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
