/**
 * HTTP-level checks for the Exports seller directory: the real controller and service behind
 * an HTTP server, Hasura mocked with fixture rows. Set PRINT_HTTP_EVIDENCE=1 to print bodies.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard';
import { CatalogCacheService } from '../catalog-cache/catalog-cache.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { InventoryItemsController } from './inventory-items.controller';
import { InventoryItemsService } from './inventory-items.service';
import { StoreBrowseContextService } from './store-browse-context.service';
import { ConfigService } from '@nestjs/config';
import { GoogleDistanceService } from '../google/google-distance.service';
import { ItemEmbeddingService } from '../embeddings/item-embedding.service';
import { RbacService } from '../rbac/rbac.service';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Fixture locations: 11 Canadian exporters, 1 Cameroonian, 1 demoted. */
const LOCS = [
  ...Array.from({ length: 11 }, (_, i) => ({
    id: uuid(i + 1),
    name: i === 0 ? 'Maple Ridge Foods' : `CA Seller ${String(i + 1).padStart(2, '0')}`,
    country: 'CA',
    city: 'Montreal',
    tier: 'ok',
  })),
  { id: uuid(20), name: 'Douala Export Co', country: 'CM', city: 'Douala', tier: 'ok' },
  { id: uuid(21), name: 'Demoted Exporter', country: 'CA', city: 'Laval', tier: 'suspend' },
];

/** Export inventory rows: Maple Ridge has 5 items, the others 1–3; destinations vary. */
const EXPORT_ROWS = LOCS.flatMap((loc, li) => {
  const n = li === 0 ? 5 : (li % 3) + 1;
  return Array.from({ length: n }, (_, k) => ({
    item_id: `${loc.id}-item-${k}`,
    business_location_id: loc.id,
    created_at: `2026-11-${String(10 + li).padStart(2, '0')}T12:00:00.000Z`,
    country: loc.country,
    markets: loc.country === 'CA' ? (k % 2 === 0 ? ['CM', 'GA'] : ['CD']) : ['CA'],
  }));
});

function matchesWhere(row: (typeof EXPORT_ROWS)[number], where: unknown): boolean {
  const json = JSON.stringify(where);
  const origin = /"address":\{"country":\{"_eq":"([A-Z]{2})"\}\}/.exec(json)?.[1];
  const market = /"export_markets":\{"country_code":\{"_eq":"([A-Z]{2})"\}\}/.exec(json)?.[1];
  const loc = /"business_location_id":\{"_eq":"([^"]+)"\}/.exec(json)?.[1];
  if (origin && row.country !== origin) return false;
  if (market && !row.markets.includes(market)) return false;
  if (loc && row.business_location_id !== loc) return false;
  return true;
}

describe('Exports by seller over HTTP (GET /inventory-items/stores)', () => {
  let app: INestApplication;
  let base: string;
  const calls: string[] = [];
  const hasuraSystem = {
    executeQuery: jest.fn(async (query: string, vars: any) => {
      const name = /query (\w+)/.exec(query)?.[1] ?? 'unknown';
      calls.push(name);
      if (name === 'ExportStoreRows') {
        const rows = EXPORT_ROWS.filter((r) => matchesWhere(r, vars.where));
        return { business_inventory: rows.slice(vars.off, vars.off + vars.lim) };
      }
      if (name === 'ScanLocItemIds') {
        return {
          business_inventory:
            vars.off > 0
              ? []
              : [
                  { item_id: 'local-1', business_location_id: uuid(1) },
                  { item_id: 'local-2', business_location_id: uuid(1) },
                  { item_id: 'local-3', business_location_id: uuid(2) },
                ],
        };
      }
      if (name === 'StoreLocationDetails') {
        return {
          business_locations: LOCS.filter((l) => vars.ids.includes(l.id)).map((l) => ({
            id: l.id,
            business_id: `biz-${l.id.slice(-2)}`,
            name: l.name,
            is_active: true,
            logo_url: l.id === uuid(1) ? 'https://cdn.example/maple.png' : null,
            business: {
              name: `${l.name} Inc`,
              is_verified: true,
              can_accept_orders: true,
              is_storefront_visible: true,
              reliability_tier: l.tier,
            },
            address: { city: l.city, country: l.country, state: null },
          })),
        };
      }
      if (name === 'ActivePartnerBusinessIds') return { partner_businesses: [] };
      if (name === 'ValidateExportMarket' || name === 'ValidateLocationSupport') {
        return { supported_country_states: [{ id: 'ok' }] };
      }
      return {};
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InventoryItemsController],
      providers: [
        InventoryItemsService,
        { provide: HasuraSystemService, useValue: hasuraSystem },
        {
          provide: HasuraUserService,
          useValue: {
            getUserId: jest.fn(() => 'anonymous'),
            getUser: jest.fn(async () => {
              throw new Error('anonymous');
            }),
          },
        },
        { provide: GoogleDistanceService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: ItemEmbeddingService, useValue: {} },
        { provide: RbacService, useValue: {} },
        {
          provide: CatalogCacheService,
          useValue: {
            getGeneration: jest.fn(async () => 0),
            getOrCompute: jest.fn(async (_k: string, compute: () => Promise<unknown>) =>
              compute()
            ),
          },
        },
        { provide: StoreBrowseContextService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    calls.length = 0;
  });

  async function get(qs: string) {
    const res = await fetch(`${base}/inventory-items/stores?${qs}`);
    const json = await res.json();
    if (process.env.PRINT_HTTP_EVIDENCE) {
      const data = json.data ?? {};
      const brief = {
        total: data.total,
        country: data.country,
        stores: (data.stores ?? []).map((s: any) =>
          [s.name, s.item_count, s.country ?? '-', s.latest_export_at?.slice(0, 10) ?? '-'].join(' | ')
        ),
        keys: Object.keys(data),
      };
      console.log(`GET /inventory-items/stores?${qs} -> ${res.status} ${JSON.stringify(brief)}`);
    }
    return { status: res.status, json };
  }

  it('From CA: export sellers only, export counts, ordered by count then recency, total + country', async () => {
    const { status, json } = await get('export_only=true&origin_country=ca&limit=10');
    expect(status).toBe(200);
    expect(json.data.country).toBe('CA');
    expect(json.data.total).toBe(11); // 11 CA sellers; the suspended one and CM are excluded
    expect(json.data.stores).toHaveLength(10);
    expect(json.data.stores[0]).toEqual(
      expect.objectContaining({
        name: 'Maple Ridge Foods',
        item_count: 5,
        country: 'CA',
        city: 'Montreal',
        logo_url: 'https://cdn.example/maple.png',
        distance_meters: null,
      })
    );
    const counts = json.data.stores.map((s: any) => s.item_count);
    expect(counts).toEqual([...counts].sort((a: number, b: number) => b - a));
    expect(json.data.stores.every((s: any) => s.country === 'CA')).toBe(true);
    expect(calls).toContain('ExportStoreRows');
    expect(calls).not.toContain('ScanLocItemIds');
  });

  it('From CA page 2 (offset=10) returns the 11th seller', async () => {
    const { json } = await get('export_only=true&origin_country=CA&limit=10&offset=10');
    expect(json.data.total).toBe(11);
    expect(json.data.stores).toHaveLength(1);
  });

  it('Into CM: sellers with items exported into CM, counting only those items', async () => {
    const { json } = await get('export_only=true&country_code=CM&limit=50');
    expect(json.data.country).toBe('CM');
    const maple = json.data.stores.find((s: any) => s.name === 'Maple Ridge Foods');
    expect(maple.item_count).toBe(3); // items 0, 2, 4 ship to CM
    expect(json.data.stores.some((s: any) => s.country === 'CM')).toBe(false);
  });

  it('search matches location or business name', async () => {
    const { json } = await get('export_only=true&origin_country=CA&search=maple');
    expect(json.data.total).toBe(1);
    expect(json.data.stores[0].name).toBe('Maple Ridge Foods');
    const none = await get('export_only=true&origin_country=CA&search=nordiqq');
    expect(none.json.data).toEqual({ stores: [], total: 0, country: 'CA' });
  });

  it('business_location_id scopes the seller page header', async () => {
    const { json } = await get(`export_only=true&origin_country=CA&business_location_id=${uuid(1)}`);
    expect(json.data.total).toBe(1);
    expect(json.data.stores[0].item_count).toBe(5);
  });

  it('unknown origin returns an empty page, not an error', async () => {
    const { status, json } = await get('export_only=true&origin_country=ZZ');
    expect(status).toBe(200);
    expect(json.data).toEqual({ stores: [], total: 0, country: 'ZZ' });
  });

  it('without export_only the response shape and query path are unchanged', async () => {
    const { status, json } = await get('country_code=CM&limit=20');
    expect(status).toBe(200);
    expect(Object.keys(json.data)).toEqual(['stores']);
    expect(json.data.total).toBeUndefined();
    expect(json.data.country).toBeUndefined();
    expect(json.data.stores[0]).not.toHaveProperty('country');
    expect(json.data.stores[0]).not.toHaveProperty('latest_export_at');
    expect(calls).toContain('ScanLocItemIds');
    expect(calls).not.toContain('ExportStoreRows');
  });

  it('origin_country / offset / business_location_id are ignored without export_only', async () => {
    const { json } = await get(
      `country_code=CM&origin_country=CA&offset=10&business_location_id=${uuid(2)}`
    );
    expect(Object.keys(json.data)).toEqual(['stores']);
    expect(json.data.stores.map((s: any) => s.business_location_id)).toEqual([uuid(1), uuid(2)]);
    expect(calls).not.toContain('ExportStoreRows');
  });
});
