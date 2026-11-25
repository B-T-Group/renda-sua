import { MarketLanesService } from './market-lanes.service';

describe('MarketLanesService', () => {
  const hasura = { executeQuery: jest.fn() };
  const cache = {
    getOrCompute: jest.fn(
      (_key: string, compute: () => Promise<unknown>) => compute()
    ),
  };
  let service: MarketLanesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketLanesService(hasura as any, cache as any);
  });

  it('always shows shop and rentals; gates food and exports', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('MarketLanesCountryState')) {
        return { supported_country_states: [{ id: '1' }] };
      }
      if (query.includes('MarketLanesFood')) {
        return { business_inventory_aggregate: { aggregate: { count: 0 } } };
      }
      if (query.includes('MarketLanesExports')) {
        return { business_inventory_aggregate: { aggregate: { count: 1 } } };
      }
      return {};
    });

    const result = await service.getMarketLanes('cm');

    expect(result.country_code).toBe('CM');
    expect(result.lanes).toEqual({
      rentals: true,
      exports: true,
      shop: true,
      food: false,
    });
    expect(result.visible).toEqual(['rentals', 'exports', 'shop']);
    expect(cache.getOrCompute).toHaveBeenCalled();
  });

  it('keeps shop and rentals when delivery is off; still gates food', async () => {
    hasura.executeQuery.mockImplementation(async (query: string, vars?: any) => {
      if (query.includes('MarketLanesCountryState')) {
        if (vars?.where?.delivery_enabled) {
          return { supported_country_states: [] };
        }
        return { supported_country_states: [{ id: '1' }] };
      }
      if (query.includes('MarketLanesExports')) {
        return { business_inventory_aggregate: { aggregate: { count: 1 } } };
      }
      return {};
    });

    const result = await service.getMarketLanes('CD');

    expect(result.lanes).toEqual({
      rentals: true,
      exports: true,
      shop: true,
      food: false,
    });
    expect(result.visible).toEqual(['rentals', 'exports', 'shop']);
    const inventoryCalls = hasura.executeQuery.mock.calls.filter(([q]) =>
      String(q).includes('business_inventory_aggregate')
    );
    expect(inventoryCalls).toHaveLength(1);
    expect(String(inventoryCalls[0][0])).toContain('MarketLanesExports');
  });
});
