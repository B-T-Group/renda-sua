import { AdminOrdersService } from './admin-orders.service';
import {
  AdminOrderQueue,
  OrderStatusFilter,
  RiskSeverityFilter,
  type GetAdminOrdersDto,
} from './dto/admin-orders.dto';

function setup(orders: any[] = []) {
  const executeQuery = jest.fn().mockResolvedValue({
    orders,
    filtered: { aggregate: { count: orders.length } },
    active: { aggregate: { count: 12 } },
    atRisk: { aggregate: { count: 4 } },
    critical: { aggregate: { count: 1 } },
    warning: { aggregate: { count: 3 } },
  });
  const service = new AdminOrdersService({ executeQuery } as never);
  return { service, executeQuery };
}

function lastVariables(executeQuery: jest.Mock) {
  return executeQuery.mock.calls[executeQuery.mock.calls.length - 1][1];
}

describe('AdminOrdersService.list', () => {
  it('defaults to the at-risk queue and sorts critical, longest-waiting first', async () => {
    const { service, executeQuery } = setup();
    await service.list({ queue: AdminOrderQueue.AT_RISK } as GetAdminOrdersDto);
    const vars = lastVariables(executeQuery);
    expect(vars.where._and).toContainEqual({ open_risk_rank: { _gt: 0 } });
    expect(vars.orderBy).toEqual([
      { open_risk_rank: 'desc' },
      { open_risk_since: 'asc' },
      { created_at: 'asc' },
    ]);
  });

  it('drops the risk restriction for the all-orders queue', async () => {
    const { service, executeQuery } = setup();
    await service.list({ queue: AdminOrderQueue.ALL } as GetAdminOrdersDto);
    const vars = lastVariables(executeQuery);
    expect(vars.where._and).not.toContainEqual({ open_risk_rank: { _gt: 0 } });
  });

  it('filters severity on the order so pagination totals stay accurate', async () => {
    const { service, executeQuery } = setup();
    await service.list({
      queue: AdminOrderQueue.AT_RISK,
      severity: RiskSeverityFilter.CRITICAL,
    } as GetAdminOrdersDto);
    expect(lastVariables(executeQuery).where._and).toContainEqual({
      open_risk_rank: { _eq: 2 },
    });
  });

  it('filters by open incidents of a specific risk type', async () => {
    const { service, executeQuery } = setup();
    await service.list({
      queue: AdminOrderQueue.ALL,
      risk_type: 'pickup_overdue',
    } as GetAdminOrdersDto);
    expect(lastVariables(executeQuery).where._and).toContainEqual({
      risk_incidents: {
        resolved_at: { _is_null: true },
        risk_type: { _eq: 'pickup_overdue' },
      },
    });
  });

  it('narrows to a single status when one is requested', async () => {
    const { service, executeQuery } = setup();
    await service.list({
      queue: AdminOrderQueue.ALL,
      status: OrderStatusFilter.READY_FOR_PICKUP,
    } as GetAdminOrdersDto);
    expect(lastVariables(executeQuery).where._and).toContainEqual({
      current_status: { _eq: 'ready_for_pickup' },
    });
  });

  it('returns queue counts alongside the page', async () => {
    const { service } = setup();
    const result = await service.list({
      queue: AdminOrderQueue.AT_RISK,
    } as GetAdminOrdersDto);
    expect(result.counts).toEqual({
      total: 12,
      at_risk: 4,
      critical: 1,
      warning: 3,
    });
  });

  it('surfaces the leading incident, contacts, and next action on each row', async () => {
    const { service } = setup([
      {
        id: 'order-1',
        order_number: 'ORD-1',
        current_status: 'assigned_to_agent',
        open_risk_rank: 2,
        open_risk_since: '2026-08-26T10:00:00.000Z',
        risk_incidents: [
          {
            id: 'i-1',
            risk_type: 'pending_acceptance',
            severity: 'warning',
            detected_at: '2026-08-26T09:00:00.000Z',
            last_seen_at: '2026-08-26T11:00:00.000Z',
            overdue_minutes: 30,
            context: { reason: 'Merchant has not confirmed' },
            notified_count: 1,
          },
          {
            id: 'i-2',
            risk_type: 'pickup_overdue',
            severity: 'critical',
            detected_at: '2026-08-26T10:00:00.000Z',
            last_seen_at: '2026-08-26T11:00:00.000Z',
            overdue_minutes: 90,
            context: { reason: 'Assigned agent has not picked up' },
            notified_count: 2,
          },
        ],
        client: { id: 'c-1', user: { id: 'u-1', first_name: 'Ada', email: 'a@b.c' } },
        assigned_agent: { id: 'a-1', user: { id: 'u-2', first_name: 'Kofi' } },
      },
    ]);
    const [row] = (
      await service.list({ queue: AdminOrderQueue.AT_RISK } as GetAdminOrdersDto)
    ).orders;

    expect(row.risk_level).toBe('critical');
    expect(row.risk_type).toBe('pickup_overdue');
    expect(row.next_action).toBe('contact_agent');
    expect(row.risk_incidents.map((i) => i.id)).toEqual(['i-2', 'i-1']);
    expect(row.contacts.map((c) => c.role)).toEqual(['client', 'agent']);
    expect(row.capabilities.can_redispatch).toBe(true);
  });
});
