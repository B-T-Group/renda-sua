import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GeoScopeService } from './geo-scope.service';

const MARKETS = {
  supported_country_states: [
    {
      id: 's1',
      country_code: 'cm',
      country_name: ' Cameroon ',
      state_name: 'Littoral',
      state_key: 'littoral',
    },
  ],
};

const CM_STATE = {
  all: false as const,
  countries: [] as string[],
  states: [{ countryCode: 'CM', stateKey: 'littoral' }],
};

function harness(handlers: Record<string, () => unknown> = {}) {
  const executeQuery = jest.fn(async (query: string) => {
    if (query.includes('GeoMarkets')) return MARKETS;
    for (const [needle, respond] of Object.entries(handlers)) {
      if (query.includes(needle)) return respond();
    }
    return {};
  });
  const getUser = jest.fn();
  const getScope = jest.fn();
  const service = new GeoScopeService(
    { executeQuery } as any,
    { getUser } as any,
    { getScope } as any
  );
  return { service, executeQuery, getUser, getScope };
}

describe('GeoScopeService.requireAny', () => {
  it('denies a missing user and a user with no matching scope', async () => {
    const { service, getUser, getScope } = harness();
    getUser.mockResolvedValue(null);
    await expect(service.requireAny(['platform.orders.cross_business'])).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(getScope).not.toHaveBeenCalled();

    getUser.mockResolvedValue({ id: 'user-1' });
    getScope.mockResolvedValue(null);
    await expect(service.require('platform.orders.cross_business')).rejects.toThrow('Access denied');
  });

  it('unions country scopes and lets one global scope win', async () => {
    const { service, getUser, getScope } = harness();
    getUser.mockResolvedValue({ id: 'user-1' });
    getScope
      .mockResolvedValueOnce({ all: false, countries: ['CM'], states: [] })
      .mockResolvedValueOnce({ all: false, countries: [], states: [{ countryCode: 'GA', stateKey: 'estuaire' }] });

    await expect(service.requireAny(['orders', 'map'])).resolves.toEqual({
      all: false,
      countries: ['CM'],
      states: [{ countryCode: 'GA', stateKey: 'estuaire' }],
    });

    getScope.mockResolvedValue({ all: true });
    await expect(service.requireAny(['orders', 'map'])).resolves.toEqual({ all: true });
  });
});

describe('GeoScopeService order and party checks', () => {
  it('does not look up an order when the scope is missing or global', async () => {
    const { service, getScope, executeQuery } = harness();
    getScope.mockResolvedValue(null);
    await expect(service.coversOrder('user-1', 'orders', 'order-1')).resolves.toBe(false);

    getScope.mockResolvedValue({ all: true });
    await expect(service.coversOrder('user-1', 'orders', 'order-1')).resolves.toBe(true);
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('uses the shop country and hides an out-of-scope order', async () => {
    const order = {
      business_location: { address: { country: 'Gabon', state: 'Estuaire' } },
      delivery_address: { country: 'Cameroon', state: 'Littoral' },
    };
    const { service, executeQuery } = harness({
      OrderGeo: () => ({ orders_by_pk: order }),
    });

    await expect(service.assertOrder(CM_STATE, 'order-1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.assertOrder(CM_STATE, 'order-1')).rejects.toThrow('Order not found');
    expect(executeQuery).toHaveBeenCalled();
  });

  it('falls back to delivery when the shop has no country', async () => {
    const { service } = harness({
      OrderGeo: () => ({
        orders_by_pk: {
          business_location: { address: { country: '', state: null } },
          delivery_address: { country: 'Cameroon', state: 'Littoral Region' },
        },
      }),
    });

    await expect(service.assertOrder(CM_STATE, 'order-1')).resolves.toBeUndefined();
  });

  it('hides a missing order and a missing incident', async () => {
    const { service } = harness({
      OrderGeo: () => ({ orders_by_pk: null }),
      IncidentOrder: () => ({ order_risk_incidents_by_pk: null }),
    });

    await expect(service.assertOrder(CM_STATE, 'missing')).rejects.toThrow('Order not found');
    await expect(service.assertIncident(CM_STATE, 'missing')).rejects.toThrow('Incident not found');
    await expect(service.assertOrder({ all: true }, 'missing')).resolves.toBeUndefined();
  });

  it('matches a business by address when the account country is outside the state', async () => {
    const { service } = harness({
      BusinessGeo: () => ({
        businesses_by_pk: {
          user: { country: 'GA' },
          business_addresses: [{ address: { country: '', state: 'Littoral' } }],
          business_locations: [{ address: { country: 'Cameroon', state: 'Littoral' } }],
        },
      }),
    });

    await expect(service.assertBusiness(CM_STATE, 'biz-1')).resolves.toBeUndefined();
  });

  it('hides a business that is only present in another state', async () => {
    const { service } = harness({
      BusinessGeo: () => ({
        businesses_by_pk: {
          user: { country: 'CM' },
          business_addresses: [],
          business_locations: [{ address: { country: 'Cameroon', state: 'Centre' } }],
        },
      }),
    });

    await expect(service.assertBusiness(CM_STATE, 'biz-1')).rejects.toThrow('Business not found');
    await expect(service.assertAgent(CM_STATE, 'missing')).rejects.toThrow('Agent not found');
  });
});

describe('GeoScopeService markets', () => {
  it('caches a successful load and retries after a failure', async () => {
    const { service, executeQuery } = harness();
    executeQuery.mockRejectedValueOnce(new Error('down'));
    await expect(service.markets()).rejects.toThrow('down');

    executeQuery.mockResolvedValueOnce(MARKETS);
    const first = await service.markets();
    const second = await service.markets();

    expect(first).toEqual([
      {
        countryCode: 'CM',
        countryName: 'Cameroon',
        stateId: 's1',
        stateName: 'Littoral',
        stateKey: 'littoral',
      },
    ]);
    expect(second).toBe(first);
    expect(executeQuery).toHaveBeenCalledTimes(2);
    await expect(service.normalizeCountry('cameroon')).resolves.toBe('CM');
  });
});
