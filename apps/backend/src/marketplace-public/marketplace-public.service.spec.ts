import { MarketplacePublicService } from './marketplace-public.service';

const STATS_PAYLOAD = {
  clients_aggregate: { aggregate: { count: 80 } },
  agents_aggregate: { aggregate: { count: 9 } },
  businesses_aggregate: { aggregate: { count: 4 } },
  business_inventory_aggregate: { aggregate: { count: 12 } },
  orders_aggregate: { aggregate: { count: 7 } },
  city_locations: [
    { id: 'l1', address: { city: 'Douala' } },
    { id: 'l2', address: { city: ' douala ' } },
    { id: 'l3', address: { city: 'Yaoundé' } },
    { id: 'l4', address: { city: '' } },
    { id: 'l5', address: { city: null } },
  ],
  logo_locations: [
    {
      id: 'logo-1',
      name: 'Alpha',
      logo_url: ' https://cdn.example/a.png ',
    },
    {
      id: 'logo-2',
      name: 'Alpha Dup',
      logo_url: 'https://cdn.example/a.png',
    },
    { id: 'logo-3', name: null, logo_url: 'https://cdn.example/b.png' },
    { id: 'logo-4', name: 'Empty', logo_url: '   ' },
  ],
};

describe('MarketplacePublicService', () => {
  let service: MarketplacePublicService;
  let hasura: { executeQuery: jest.Mock };

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    service = new MarketplacePublicService(hasura as any);
  });

  it('maps aggregates, distinct cities, and dedupes logos', async () => {
    hasura.executeQuery.mockResolvedValue(STATS_PAYLOAD);

    const result = await service.getPublicStats();

    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('MarketplacePublicStats'),
      { cityLimit: 2000, logoLimit: 12 }
    );
    const query = String(hasura.executeQuery.mock.calls[0][0]);
    expect(query).toContain('account_status: { _neq: "deleted" }');
    expect(query).toContain('is_verified: { _eq: true }');
    expect(query).toContain('is_storefront_visible: { _eq: true }');
    expect(query).toContain('moderation_status: { _eq: "approved" }');
    expect(query).toContain('current_status: { _in: ["delivered", "complete"] }');
    expect(result).toEqual({
      clients: 80,
      agents: 9,
      merchants: 4,
      products: 12,
      cities: 2,
      orders: 7,
      setupMinutesMax: 5,
      securePaymentsPercent: 100,
      logos: [
        {
          id: 'logo-1',
          name: 'Alpha',
          logoUrl: 'https://cdn.example/a.png',
        },
        {
          id: 'logo-3',
          name: 'Store',
          logoUrl: 'https://cdn.example/b.png',
        },
      ],
    });
  });

  it('reuses cached stats within the TTL', async () => {
    hasura.executeQuery.mockResolvedValue(STATS_PAYLOAD);
    await service.getPublicStats();
    await service.getPublicStats();
    expect(hasura.executeQuery).toHaveBeenCalledTimes(1);
  });

  it('returns empty stats when Hasura fails', async () => {
    hasura.executeQuery.mockRejectedValue(new Error('hasura down'));

    await expect(service.getPublicStats()).resolves.toEqual({
      clients: 0,
      agents: 0,
      merchants: 0,
      products: 0,
      cities: 0,
      orders: 0,
      setupMinutesMax: 5,
      securePaymentsPercent: 100,
      logos: [],
    });
  });

  it('keeps last successful stats when a later fetch fails', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    hasura.executeQuery
      .mockResolvedValueOnce(STATS_PAYLOAD)
      .mockRejectedValueOnce(new Error('hasura down'));
    const first = await service.getPublicStats();
    jest.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    const second = await service.getPublicStats();
    jest.useRealTimers();
    expect(second.clients).toBe(first.clients);
    expect(second.agents).toBe(first.agents);
  });

  it('treats missing aggregate counts as zero', async () => {
    hasura.executeQuery.mockResolvedValue({
      clients_aggregate: { aggregate: null },
      agents_aggregate: {},
      businesses_aggregate: { aggregate: null },
      business_inventory_aggregate: {},
      orders_aggregate: { aggregate: { count: null } },
      city_locations: [],
      logo_locations: [],
    });

    const result = await service.getPublicStats();
    expect(result.clients).toBe(0);
    expect(result.agents).toBe(0);
    expect(result.merchants).toBe(0);
    expect(result.products).toBe(0);
    expect(result.orders).toBe(0);
    expect(result.cities).toBe(0);
    expect(result.logos).toEqual([]);
  });
});
