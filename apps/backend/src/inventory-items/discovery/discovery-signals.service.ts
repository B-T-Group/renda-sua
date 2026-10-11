import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import type { PopularityMap } from './discovery-sort.util';

/** Orders that count as demand: completed + still active (not cancelled / failed / refunded). */
export const POPULARITY_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'complete',
];

export const POPULARITY_WINDOW_DAYS = 90;
export const POPULARITY_SHORT_WINDOW_DAYS = 30;
const CHUNK = 2000;
const MAX_ROWS = 20_000;
const TTL_MS = 10 * 60 * 1000;
const MS_PER_DAY = 86_400_000;

const POPULARITY_GQL = `
  query DiscoveryPopularity($where: order_items_bool_exp!, $limit: Int!, $offset: Int!) {
    order_items(where: $where, limit: $limit, offset: $offset, order_by: { created_at: desc }) {
      item_id
      order { created_at }
    }
  }
`;

/**
 * 30-day in-market order counts per catalog item (ties by 90-day). Computed from order_items in
 * one paged read per market and cached in memory for 10 minutes, so a ranking request never
 * fans out into per-item queries.
 */
@Injectable()
export class DiscoverySignalsService {
  private readonly logger = new Logger(DiscoverySignalsService.name);
  private readonly cache = new Map<string, { at: number; value: PopularityMap }>();
  private readonly inflight = new Map<string, Promise<PopularityMap>>();

  constructor(private readonly hasura: HasuraSystemService) {}

  async getPopularity(
    country: string | undefined,
    nowMs: number = Date.now()
  ): Promise<PopularityMap> {
    const key = (country ?? 'ALL').toUpperCase();
    const hit = this.cache.get(key);
    if (hit && nowMs - hit.at < TTL_MS) return hit.value;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const run = this.load(key === 'ALL' ? undefined : key, nowMs)
      .then((value) => {
        this.cache.set(key, { at: nowMs, value });
        return value;
      })
      .catch((e: any) => {
        // Popularity is a ranking nicety: fall back to an empty map (ties resolve by newest).
        this.logger.warn(`Popularity signal skipped: ${e?.message ?? e}`);
        return new Map() as PopularityMap;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, run);
    return run;
  }

  private async load(
    country: string | undefined,
    nowMs: number
  ): Promise<PopularityMap> {
    const since = new Date(nowMs - POPULARITY_WINDOW_DAYS * MS_PER_DAY);
    const where: Record<string, unknown> = {
      order: {
        created_at: { _gte: since.toISOString() },
        current_status: { _in: POPULARITY_ORDER_STATUSES },
        ...(country
          ? { business_location: { address: { country: { _eq: country } } } }
          : {}),
      },
    };
    const shortCutoff = nowMs - POPULARITY_SHORT_WINDOW_DAYS * MS_PER_DAY;
    const out: PopularityMap = new Map();
    for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
      const res = await this.hasura.executeQuery(POPULARITY_GQL, {
        where,
        limit: CHUNK,
        offset,
      });
      const rows: Array<{ item_id: string; order?: { created_at?: string } }> =
        res?.order_items ?? [];
      for (const r of rows) {
        const t = Date.parse(r.order?.created_at ?? '');
        const cur = out.get(r.item_id) ?? { d30: 0, d90: 0 };
        cur.d90 += 1;
        if (Number.isFinite(t) && t >= shortCutoff) cur.d30 += 1;
        out.set(r.item_id, cur);
      }
      if (rows.length < CHUNK) break;
    }
    return out;
  }
}
