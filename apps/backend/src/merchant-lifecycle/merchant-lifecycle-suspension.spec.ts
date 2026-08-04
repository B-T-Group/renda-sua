import { MerchantLifecycleService } from './merchant-lifecycle.service';
import { SUSPENSION_REASON_RELIABILITY_MISSED_ORDERS } from './merchant-lifecycle.types';

describe('MerchantLifecycleService suspension', () => {
  const activeBiz = {
    id: 'biz-1',
    name: 'Acme',
    lifecycle_status: 'active',
    is_storefront_visible: true,
    can_accept_orders: true,
    is_verified: true,
  };
  const suspendedBiz = {
    ...activeBiz,
    lifecycle_status: 'suspended',
  };

  function createService() {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const service = new MerchantLifecycleService(
      hasura as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { service, hasura };
  }

  function routeByQuery(hasura: { executeQuery: jest.Mock }, handlers: {
    BusinessLifecycle?: any;
    LatestSuspend?: any;
    BizTier?: any;
  }) {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      const q = String(query);
      if (q.includes('LatestSuspend')) {
        return {
          business_lifecycle_status_history: handlers.LatestSuspend ?? [],
        };
      }
      if (q.includes('BizTier')) {
        return { businesses_by_pk: handlers.BizTier ?? null };
      }
      if (q.includes('BusinessLifecycle')) {
        return { businesses_by_pk: handlers.BusinessLifecycle ?? null };
      }
      throw new Error(`Unexpected query: ${q.slice(0, 80)}`);
    });
  }

  it('suspendBySystem writes history with reliability reason and is idempotent', async () => {
    const { service, hasura } = createService();
    let snapshot = activeBiz;
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('BusinessLifecycle')) {
        return { businesses_by_pk: snapshot };
      }
      throw new Error('unexpected query');
    });
    hasura.executeMutation.mockImplementation(async (mutation: string) => {
      if (String(mutation).includes('SetLifecycle')) {
        snapshot = suspendedBiz;
      }
      return {};
    });

    const first = await service.suspendBySystem('biz-1');
    expect(first?.lifecycle_status).toBe('suspended');

    const setCall = hasura.executeMutation.mock.calls.find(([m]) =>
      String(m).includes('SetLifecycle')
    );
    expect(setCall?.[1]).toEqual({ id: 'biz-1', status: 'suspended' });

    const historyCall = hasura.executeMutation.mock.calls.find(([m]) =>
      String(m).includes('InsertLifecycleHistory')
    );
    expect(historyCall?.[1].row).toMatchObject({
      business_id: 'biz-1',
      from_status: 'active',
      to_status: 'suspended',
      reason: SUSPENSION_REASON_RELIABILITY_MISSED_ORDERS,
      changed_by_type: 'system',
      changed_by_user_id: null,
    });

    hasura.executeMutation.mockClear();
    const second = await service.suspendBySystem('biz-1');
    expect(second?.lifecycle_status).toBe('suspended');
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('maps admin and reliability suspension history codes', async () => {
    const { service, hasura } = createService();
    routeByQuery(hasura, {
      LatestSuspend: [
        {
          reason: 'policy_violation',
          changed_by_type: 'admin',
          created_at: '2026-08-01T12:00:00.000Z',
        },
      ],
    });

    await expect(service.getLatestSuspension('biz-1')).resolves.toEqual({
      code: 'admin',
      suspendedAt: '2026-08-01T12:00:00.000Z',
    });

    routeByQuery(hasura, {
      LatestSuspend: [
        {
          reason: 'reliability_missed_orders',
          changed_by_type: 'system',
          created_at: '2026-08-02T12:00:00.000Z',
        },
      ],
    });

    await expect(service.getLatestSuspension('biz-1')).resolves.toEqual({
      code: 'reliability_missed_orders',
      suspendedAt: '2026-08-02T12:00:00.000Z',
    });
  });

  it('infers reliability suspension from tier when history is missing', async () => {
    const { service, hasura } = createService();
    routeByQuery(hasura, {
      LatestSuspend: [],
      BizTier: {
        lifecycle_status: 'suspended',
        reliability_tier: 'suspend',
      },
    });

    await expect(service.getLatestSuspension('biz-1')).resolves.toEqual({
      code: 'reliability_missed_orders',
      suspendedAt: null,
    });
  });

  it('returns null when business is not suspended and history is empty', async () => {
    const { service, hasura } = createService();
    routeByQuery(hasura, {
      LatestSuspend: [],
      BizTier: {
        lifecycle_status: 'active',
        reliability_tier: 'good',
      },
    });

    await expect(service.getLatestSuspension('biz-1')).resolves.toBeNull();
  });
});
