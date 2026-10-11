import {
  DiscoverySignalsService,
  POPULARITY_ORDER_STATUSES,
} from './discovery-signals.service';

const NOW = Date.parse('2026-10-11T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe('DiscoverySignalsService', () => {
  it('counts 30-day and 90-day orders per item, scoped to the market and to live orders', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        order_items: [
          { item_id: 'a', order: { created_at: ago(2) } },
          { item_id: 'a', order: { created_at: ago(29) } },
          { item_id: 'a', order: { created_at: ago(45) } },
          { item_id: 'b', order: { created_at: ago(80) } },
        ],
      }),
    };
    const svc = new DiscoverySignalsService(hasura as any);
    const map = await svc.getPopularity('cm', NOW);
    expect(map.get('a')).toEqual({ d30: 2, d90: 3 });
    expect(map.get('b')).toEqual({ d30: 0, d90: 1 });
    const where = hasura.executeQuery.mock.calls[0][1].where;
    expect(where.order.business_location.address.country._eq).toBe('CM');
    expect(where.order.current_status._in).toEqual(POPULARITY_ORDER_STATUSES);
    expect(POPULARITY_ORDER_STATUSES).not.toContain('cancelled');
    expect(POPULARITY_ORDER_STATUSES).not.toContain('failed');
    expect(POPULARITY_ORDER_STATUSES).not.toContain('refunded');
    expect(POPULARITY_ORDER_STATUSES).not.toContain('pending_payment');
    expect(new Date(where.order.created_at._gte).getTime()).toBe(NOW - 90 * 86_400_000);
  });

  it('caches per market and shares one in-flight load', async () => {
    const hasura = { executeQuery: jest.fn().mockResolvedValue({ order_items: [] }) };
    const svc = new DiscoverySignalsService(hasura as any);
    await Promise.all([svc.getPopularity('CM', NOW), svc.getPopularity('CM', NOW)]);
    await svc.getPopularity('CM', NOW + 60_000);
    expect(hasura.executeQuery).toHaveBeenCalledTimes(1);
    await svc.getPopularity('GA', NOW);
    expect(hasura.executeQuery).toHaveBeenCalledTimes(2);
    await svc.getPopularity('CM', NOW + 11 * 60_000);
    expect(hasura.executeQuery).toHaveBeenCalledTimes(3);
  });

  it('pages until a short page', async () => {
    const page = (n: number) => ({
      order_items: Array.from({ length: n }, () => ({ item_id: 'a', order: { created_at: ago(1) } })),
    });
    const hasura = { executeQuery: jest.fn().mockResolvedValueOnce(page(2000)).mockResolvedValueOnce(page(5)) };
    const map = await new DiscoverySignalsService(hasura as any).getPopularity('CM', NOW);
    expect(hasura.executeQuery).toHaveBeenCalledTimes(2);
    expect(map.get('a')?.d90).toBe(2005);
  });

  it('a failing read degrades to an empty map instead of failing the listing', async () => {
    const hasura = { executeQuery: jest.fn().mockRejectedValue(new Error('hasura down')) };
    const map = await new DiscoverySignalsService(hasura as any).getPopularity('CM', NOW);
    expect(map.size).toBe(0);
  });
});
