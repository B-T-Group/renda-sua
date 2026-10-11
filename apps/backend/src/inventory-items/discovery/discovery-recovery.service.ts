import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import {
  InventoryItemsService,
  type GetInventoryItemsQuery,
  type InventoryItem,
} from '../inventory-items.service';
import { DISCOVERY_SORT_FLAG_KEY } from './discovery-sort.util';
import {
  buildVocabulary,
  correctQuery,
  foldText,
  type Vocabulary,
} from './spell-correct.util';

export type RecoveryRung = 'R1' | 'R2' | 'R3' | 'R4';

export interface RecoveryFilterRemoval {
  filter: 'category' | 'subcategory' | 'brand' | 'min_price' | 'max_price' | 'location_name' | 'business_name' | 'currency';
  /** Human value to show in the chip (e.g. the brand name). */
  value: string;
  /** Distinct in-market items the search would return without this filter. */
  count: number;
}

export interface RecoveryCategory {
  id: number | null;
  name: string;
}

export interface DiscoveryRecovery {
  enabled: boolean;
  query: string;
  /** R1: confident correction that returns results (client auto-searches it). */
  corrected_query: string | null;
  corrected_total: number;
  /** R2 */
  relax: RecoveryFilterRemoval[];
  /** R3 */
  similar: InventoryItem[];
  /** R4 */
  categories: RecoveryCategory[];
  popular_near_you: InventoryItem[];
  /** R5: shown only when `assistant_shopping_v1` is on for the market. */
  ask_renda: { enabled: boolean; query: string };
  /** First rung that produced something, for analytics (`search.empty_rung_clicked`). */
  first_rung: RecoveryRung | null;
}

const VOCAB_TTL_MS = 10 * 60 * 1000;
const VOCAB_ROWS = 3000;
const ASSISTANT_FLAG_KEY = 'assistant_shopping_v1';
const RELAXABLE: Array<RecoveryFilterRemoval['filter']> = [
  'category',
  'subcategory',
  'brand',
  'min_price',
  'max_price',
  'location_name',
  'business_name',
  'currency',
];

interface FlagRow {
  config_key: string;
  country_code: string | null;
  boolean_value: boolean | null;
}
const FLAG_TTL_MS = 30_000;
const RESULT_TTL_MS = 60_000;
const RESULT_CACHE_MAX = 200;
const FLAGS_GQL = `
  query DiscoveryFlags($keys: [String!]!) {
    application_configurations(where: { config_key: { _in: $keys }, status: { _eq: "active" } }) {
      config_key
      country_code
      boolean_value
    }
  }
`;

const VOCAB_GQL = `
  query DiscoveryVocabulary($where: business_inventory_bool_exp!, $limit: Int!) {
    business_inventory(where: $where, limit: $limit, order_by: { created_at: desc }) {
      item {
        name
        brand { name }
        item_sub_category { name item_category { name } }
      }
    }
  }
`;

@Injectable()
export class DiscoveryRecoveryService {
  private readonly logger = new Logger(DiscoveryRecoveryService.name);
  private readonly vocab = new Map<string, { at: number; value: Vocabulary }>();
  private flagCache: { at: number; rows: FlagRow[] } | null = null;
  private readonly results = new Map<string, { at: number; value: DiscoveryRecovery }>();
  private flagInflight: Promise<FlagRow[]> | null = null;

  constructor(
    private readonly items: InventoryItemsService,
    private readonly hasura: HasuraSystemService
  ) {}

  /**
   * Country row first, then global row, then default false. Reads both flag keys for every market
   * in one query and caches the rows for 30 s, so a mixed-market hot path never refetches per
   * request (AppConfigService keeps a single-slot cache that would thrash). Fails closed.
   */
  async flagEnabled(country?: string, key = DISCOVERY_SORT_FLAG_KEY) {
    const rows = await this.flagRows();
    const code = country?.trim().toUpperCase();
    const forKey = rows.filter((r) => r.config_key === key);
    if (code) {
      const hit = forKey.find((r) => r.country_code?.toUpperCase() === code);
      if (hit?.boolean_value != null) return hit.boolean_value === true;
    }
    const global = forKey.find((r) => !r.country_code);
    return global?.boolean_value === true;
  }

  private async flagRows(now: number = Date.now()): Promise<FlagRow[]> {
    if (this.flagCache && now - this.flagCache.at < FLAG_TTL_MS) {
      return this.flagCache.rows;
    }
    if (this.flagInflight) return this.flagInflight;
    this.flagInflight = this.hasura
      .executeQuery(FLAGS_GQL, {
        keys: [DISCOVERY_SORT_FLAG_KEY, ASSISTANT_FLAG_KEY],
      })
      .then((res: any) => {
        const rows: FlagRow[] = res?.application_configurations ?? [];
        this.flagCache = { at: now, rows };
        return rows;
      })
      .catch((e: any) => {
        this.logger.warn(`Flag read failed, discovery stays off: ${e?.message ?? e}`);
        this.flagCache = { at: now, rows: [] };
        return [] as FlagRow[];
      })
      .finally(() => {
        this.flagInflight = null;
      });
    return this.flagInflight;
  }

  /**
   * The route is public and each rung runs catalog reads, so identical requests within 60 s share
   * one result (bounded, in memory). Results are market data only: nothing user specific.
   */
  async recover(
    query: GetInventoryItemsQuery,
    now: number = Date.now()
  ): Promise<DiscoveryRecovery> {
    const key = JSON.stringify(query);
    const hit = this.results.get(key);
    if (hit && now - hit.at < RESULT_TTL_MS) return hit.value;
    const value = await this.build(query, now);
    if (this.results.size >= RESULT_CACHE_MAX) {
      this.results.delete(this.results.keys().next().value as string);
    }
    this.results.set(key, { at: now, value });
    return value;
  }

  private async build(
    query: GetInventoryItemsQuery,
    now: number
  ): Promise<DiscoveryRecovery> {
    const text = (query.search ?? '').trim();
    const base: DiscoveryRecovery = {
      enabled: true,
      query: text,
      corrected_query: null,
      corrected_total: 0,
      relax: [],
      similar: [],
      categories: [],
      popular_near_you: [],
      ask_renda: { enabled: false, query: text },
      first_rung: null,
    };
    const [askRenda, scope] = await Promise.all([
      this.flagEnabled(query.country_code, ASSISTANT_FLAG_KEY),
      text ? this.items.resolveSearchScope(text).catch(() => null) : Promise.resolve({}),
    ]);
    base.ask_renda.enabled = askRenda;

    await this.r1(base, query, text, now);
    await this.r2(base, query, scope);
    await this.r3(base, query, text);
    await this.r4(base, query);

    base.first_rung = base.corrected_query
      ? 'R1'
      : base.relax.length > 0
        ? 'R2'
        : base.similar.length > 0
          ? 'R3'
          : 'R4';
    return base;
  }

  private async r1(
    out: DiscoveryRecovery,
    query: GetInventoryItemsQuery,
    text: string,
    now: number
  ) {
    if (text.length < 4) return;
    try {
      const vocab = await this.vocabulary(query.country_code, now);
      const fixed = correctQuery(text, vocab);
      if (!fixed || fixed === foldText(text).trim()) return;
      const scope = await this.items.resolveSearchScope(fixed);
      if (!scope) return;
      const total = await this.items.countCatalogMatches(
        { ...query, search: fixed },
        scope
      );
      if (total > 0) {
        out.corrected_query = fixed;
        out.corrected_total = total;
      }
    } catch (e: any) {
      this.logger.warn(`R1 skipped: ${e?.message ?? e}`);
    }
  }

  private async r2(
    out: DiscoveryRecovery,
    query: GetInventoryItemsQuery,
    scope: Awaited<ReturnType<InventoryItemsService['resolveSearchScope']>>
  ) {
    if (!scope) return;
    const active = RELAXABLE.filter((f) => {
      const v = (query as any)[f];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
    for (const filter of active) {
      try {
        const relaxed: GetInventoryItemsQuery = { ...query };
        delete (relaxed as any)[filter];
        // Removing the category also drops its subcategory (a subcategory means nothing alone).
        if (filter === 'category') delete relaxed.subcategory;
        const count = await this.items.countCatalogMatches(relaxed, scope);
        if (count > 0) {
          out.relax.push({ filter, value: String((query as any)[filter]), count });
        }
      } catch (e: any) {
        this.logger.warn(`R2 ${filter} skipped: ${e?.message ?? e}`);
      }
    }
    out.relax.sort((a, b) => b.count - a.count);
  }

  private async r3(
    out: DiscoveryRecovery,
    query: GetInventoryItemsQuery,
    text: string
  ) {
    if (!text) return;
    try {
      const ids = await this.items.similarItemIdsForQuery(text);
      if (ids.length === 0) return;
      const page = await this.items.getInventoryItems({
        country_code: query.country_code,
        state: query.state,
        similar_item_ids: ids,
        include_unavailable: true,
        limit: 12,
        sort: 'relevance',
        discovery: { sort: 'relevance' },
      });
      out.similar = page.items;
    } catch (e: any) {
      this.logger.warn(`R3 skipped: ${e?.message ?? e}`);
    }
  }

  /** R4: guaranteed floor. Popular in-stock items for the market plus 1-3 category guesses. */
  private async r4(out: DiscoveryRecovery, query: GetInventoryItemsQuery) {
    try {
      const page = await this.items.getInventoryItems({
        country_code: query.country_code,
        state: query.state,
        include_unavailable: false,
        limit: 12,
        discovery: { sort: 'popular' },
      });
      out.popular_near_you = page.items;
      const seen = new Map<string, RecoveryCategory & { n: number }>();
      for (const it of [...out.similar, ...page.items]) {
        const cat = it.item?.item_sub_category?.item_category;
        if (!cat?.name) continue;
        const cur = seen.get(cat.name) ?? { id: cat.id ?? null, name: cat.name, n: 0 };
        cur.n += 1;
        seen.set(cat.name, cur);
      }
      out.categories = [...seen.values()]
        .sort((a, b) => b.n - a.n)
        .slice(0, 3)
        .map(({ id, name }) => ({ id, name }));
    } catch (e: any) {
      this.logger.warn(`R4 skipped: ${e?.message ?? e}`);
    }
  }

  private async vocabulary(country: string | undefined, now: number) {
    const key = (country ?? 'ALL').toUpperCase();
    const hit = this.vocab.get(key);
    if (hit && now - hit.at < VOCAB_TTL_MS) return hit.value;
    const where: Record<string, unknown> = {
      is_active: { _eq: true },
      ...(country
        ? { business_location: { address: { country: { _eq: key } } } }
        : {}),
    };
    const res = await this.hasura.executeQuery(VOCAB_GQL, {
      where,
      limit: VOCAB_ROWS,
    });
    const phrases: string[] = [];
    for (const r of res?.business_inventory ?? []) {
      const it = r.item;
      if (!it) continue;
      phrases.push(it.name ?? '');
      if (it.brand?.name) phrases.push(it.brand.name);
      if (it.item_sub_category?.name) phrases.push(it.item_sub_category.name);
      if (it.item_sub_category?.item_category?.name) {
        phrases.push(it.item_sub_category.item_category.name);
      }
    }
    const value = buildVocabulary(phrases);
    this.vocab.set(key, { at: now, value });
    return value;
  }
}
