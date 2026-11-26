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

  it('hides food and exports when the country lookup fails and still shows shop and rentals', async () => {
    hasura.executeQuery.mockRejectedValue(new Error('hasura down'));

    const result = await service.getMarketLanes('  ci ');

    expect(result.country_code).toBe('CI');
    expect(result.lanes).toEqual({
      rentals: true,
      exports: false,
      shop: true,
      food: false,
    });
    expect(result.visible).toEqual(['rentals', 'shop']);
    expect(hasura.executeQuery.mock.calls.every(([query]) => String(query).includes('MarketLanesCountryState'))).toBe(
      true
    );
  });

  it('hides a lane whose inventory count is missing or zero', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('MarketLanesCountryState')) {
        return { supported_country_states: [{ id: '1' }] };
      }
      if (query.includes('MarketLanesFood')) {
        return { business_inventory_aggregate: { aggregate: { count: 0 } } };
      }
      if (query.includes('MarketLanesExports')) {
        return { business_inventory_aggregate: null };
      }
      return {};
    });

    const result = await service.getMarketLanes('GA');

    expect(result.lanes.food).toBe(false);
    expect(result.lanes.exports).toBe(false);
    expect(result.lanes.shop).toBe(true);
    expect(result.lanes.rentals).toBe(true);
  });

  it('hides food when only the food query fails and still shows exports', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('MarketLanesCountryState')) {
        return { supported_country_states: [{ id: '1' }] };
      }
      if (query.includes('MarketLanesFood')) throw new Error('food down');
      if (query.includes('MarketLanesExports')) {
        return { business_inventory_aggregate: { aggregate: { count: 2 } } };
      }
      return {};
    });

    const result = await service.getMarketLanes('CM');

    expect(result.lanes.food).toBe(false);
    expect(result.lanes.exports).toBe(true);
    expect(result.visible).toEqual(['rentals', 'exports', 'shop']);
  });
});
