/**
 * HTTP-level checks for exports by origin: real Nest controllers and services behind an
 * HTTP server, Hasura mocked. Run with --verbose to print the response bodies.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard';
import { CatalogCacheService } from '../catalog-cache/catalog-cache.service';
import { ExportOrdersService } from '../export-orders/export-orders.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { InventoryItemsController } from '../inventory-items/inventory-items.controller';
import { InventoryItemsService } from '../inventory-items/inventory-items.service';
import { StoreBrowseContextService } from '../inventory-items/store-browse-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductInterestController } from './product-interest.controller';
import { ProductInterestService } from './product-interest.service';

const INVENTORY = {
  id: '11111111-1111-4111-8111-111111111111',
  is_active: true,
  business_location_id: 'loc-ca',
  item_id: 'item-maple',
  business_location: {
    id: 'loc-ca',
    name: 'Érablière Laval',
    business_id: 'biz-ca',
    business: { id: 'biz-ca', name: 'Érablière Laval', user_id: 'owner-ca' },
  },
  item: {
    id: 'item-maple',
    name: 'Pure maple syrup, grade A amber 1 L',
    export_available: true,
    moderation_status: 'approved',
    is_active: true,
    export_markets: [{ country_code: 'CM' }, { country_code: 'GA' }],
  },
};

describe('Exports by origin over HTTP', () => {
  let app: INestApplication;
  let base: string;
  const hasuraSystem = {
    executeQuery: jest.fn(async (query: string) => {
      if (query.includes('GetInventoryForInterest')) {
        return { business_inventory_by_pk: INVENTORY };
      }
      if (query.includes('RecentProductInterest')) {
        return { product_interest_requests: [] };
      }
      return {};
    }),
    executeMutation: jest.fn(async (_q: string, vars: any) => ({
      insert_product_interest_requests_one: {
        id: 'req-partner-1',
        created_at: '2026-11-27T21:40:00.000Z',
        status: 'submitted',
        echo_source: vars.object.source,
      },
    })),
  };
  const hasuraUser = {
    getUserId: jest.fn(() => 'user-sn'),
    getUser: jest.fn(async () => ({
      id: 'user-sn',
      client: { id: 'client-sn' },
      first_name: 'Awa',
      last_name: 'Diop',
    })),
  };
  const exportOrders = {
    isExportOrdersEnabled: jest.fn(async () => false),
    createFromInterest: jest.fn(),
  };
  const notifications = { sendBusinessProductInterestNotification: jest.fn() };
  const inventoryItems = {
    getInventoryItems: jest.fn(async () => ({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    })),
    getExportOrigins: jest.fn(async () => [
      { country_code: 'CA', item_count: 38, business_count: 14, destination_codes: ['CD', 'CM', 'GA'] },
    ]),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductInterestController, InventoryItemsController],
      providers: [
        ProductInterestService,
        { provide: HasuraSystemService, useValue: hasuraSystem },
        { provide: HasuraUserService, useValue: hasuraUser },
        { provide: ExportOrdersService, useValue: exportOrders },
        { provide: NotificationsService, useValue: notifications },
        { provide: InventoryItemsService, useValue: inventoryItems },
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

  beforeEach(() => jest.clearAllMocks());

  async function post(body: unknown) {
    const res = await fetch(`${base}/product-interest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    // Evidence for the PR (no secrets: fixture data only).
    if (process.env.PRINT_HTTP_EVIDENCE) console.log(`POST /product-interest ${JSON.stringify(body)} -> ${res.status} ${JSON.stringify(json)}`);
    return { status: res.status, json };
  }

  it('rejects in-app interest from a non-destination market with 400 NOT_EXPORTED_TO_MARKET', async () => {
    const { status, json } = await post({
      businessInventoryId: INVENTORY.id,
      countryCode: 'SN',
    });
    expect(status).toBe(400);
    expect(json).toMatchObject({ error: 'NOT_EXPORTED_TO_MARKET' });
    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects a missing countryCode with 400 (no CM default)', async () => {
    const { status, json } = await post({ businessInventoryId: INVENTORY.id });
    expect(status).toBe(400);
    expect(json).toMatchObject({ error: 'COUNTRY_CODE_REQUIRED' });
  });

  it('accepts in-app interest from a destination market', async () => {
    const { status, json } = await post({
      businessInventoryId: INVENTORY.id,
      countryCode: 'CM',
    });
    expect(status).toBe(201);
    expect(json.data).toMatchObject({ id: 'req-partner-1', source: 'in_app' });
  });

  it('accepts a public-page partner inquiry from a non-destination market', async () => {
    const { status, json } = await post({
      businessInventoryId: INVENTORY.id,
      countryCode: 'SN',
      source: 'public_export_catalog',
      note: 'Distributor in Dakar',
    });
    expect(status).toBe(201);
    expect(json.data).toMatchObject({
      id: 'req-partner-1',
      source: 'public_export_catalog',
      echo_source: 'public_export_catalog',
    });
    expect(exportOrders.createFromInterest).not.toHaveBeenCalled();
    expect(notifications.sendBusinessProductInterestNotification).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'public_export_catalog', viewerCountryCode: 'SN' })
    );
  });

  it('GET /inventory-items?export_only=true&origin_country=ca works anonymously and passes the origin', async () => {
    hasuraUser.getUserId.mockImplementation(() => 'anonymous');
    const res = await fetch(`${base}/inventory-items?export_only=true&origin_country=ca`);
    if (process.env.PRINT_HTTP_EVIDENCE) console.log(`GET /inventory-items?export_only=true&origin_country=ca -> ${res.status}`);
    expect(res.status).toBe(200);
    expect(inventoryItems.getInventoryItems).toHaveBeenCalledWith(
      expect.objectContaining({ export_only: true, origin_country: 'CA' })
    );
  });

  it('GET /inventory-items?export_only=true without origin_country sends no origin (unchanged)', async () => {
    hasuraUser.getUserId.mockImplementation(() => 'anonymous');
    const res = await fetch(`${base}/inventory-items?export_only=true&country_code=CM`);
    expect(res.status).toBe(200);
    const arg = (inventoryItems.getInventoryItems.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty('origin_country');
    expect(arg).toMatchObject({ export_only: true, country_code: 'CM' });
  });

  it('GET /inventory-items/export-origins is public and returns counts', async () => {
    hasuraUser.getUserId.mockImplementation(() => 'anonymous');
    const res = await fetch(`${base}/inventory-items/export-origins`);
    const json = await res.json();
    if (process.env.PRINT_HTTP_EVIDENCE) console.log(`GET /inventory-items/export-origins -> ${res.status} ${JSON.stringify(json)}`);
    expect(res.status).toBe(200);
    expect(json.data.origins[0]).toMatchObject({ country_code: 'CA', item_count: 38 });
  });
});
