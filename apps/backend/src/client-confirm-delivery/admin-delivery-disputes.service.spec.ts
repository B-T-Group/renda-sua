import { HttpException } from '@nestjs/common';
import { AdminDeliveryDisputesService } from './admin-delivery-disputes.service';

function build(status = 'disputed') {
  const hasura = {
    executeQuery: jest.fn(async (q: string) =>
      q.includes('ClientReportedReason')
        ? { delivery_failure_reasons: [{ id: 'reason-1' }] }
        : {
            orders: [
              { id: 'o1', client_id: 'c1', fulfillment_country: 'CM', delivery_reports: [{ id: 'r1' }] },
              { id: 'o2', client_id: 'c1', fulfillment_country: 'CM', delivery_reports: [] },
            ],
          }
    ),
  };
  const users = { getUser: jest.fn().mockResolvedValue({ id: 'admin-1' }) };
  const repo = {
    loadOrder: jest.fn().mockResolvedValue({ id: 'o1', current_status: status, business_id: 'b1' }),
    resolveReports: jest.fn().mockResolvedValue(1),
    countUnsupportedReports: jest.fn().mockResolvedValue(2),
  };
  const market = {
    forOrder: jest.fn().mockResolvedValue({ clientFlagThreshold: 2, clientFlagWindowDays: 90 }),
  };
  const orders = {
    completeAfterClientConfirmation: jest.fn().mockResolvedValue({ alreadyComplete: false }),
    failDisputedDelivery: jest.fn().mockResolvedValue(true),
  };
  const failed = { resolveFailedDeliveryForActor: jest.fn().mockResolvedValue({}) };
  const svc = new AdminDeliveryDisputesService(
    hasura as any,
    users as any,
    repo as any,
    market as any,
    orders as any,
    failed as any
  );
  return { svc, hasura, repo, orders, failed };
}

describe('AdminDeliveryDisputesService', () => {
  it('lists disputes and flags repeat unsupported reporters (counted once per client)', async () => {
    const ctx = build();
    const rows = await ctx.svc.list();
    expect(rows).toHaveLength(2);
    expect(rows[0].clientFlagged).toBe(true);
    expect(rows[0].reports).toEqual([{ id: 'r1' }]);
    expect(ctx.repo.countUnsupportedReports).toHaveBeenCalledTimes(1);
  });

  it('complete: settles via the disputed→complete path and marks reports unsupported', async () => {
    const ctx = build();
    const r = await ctx.svc.resolve('o1', { resolution: 'complete', note: 'photo shows delivery' });
    expect(ctx.orders.completeAfterClientConfirmation).toHaveBeenCalledWith(
      'o1',
      expect.stringContaining('complete'),
      'admin',
      { fromDisputed: true, changedByUserId: 'admin-1' }
    );
    expect(ctx.failed.resolveFailedDeliveryForActor).not.toHaveBeenCalled();
    expect(r.outcome).toBe('unsupported');
    expect(ctx.repo.resolveReports).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'o1', outcome: 'unsupported', adminUserId: 'admin-1' })
    );
  });

  it('agent_fault: fails the order then runs the existing fault resolution', async () => {
    const ctx = build();
    const r = await ctx.svc.resolve('o1', { resolution: 'agent_fault' });
    expect(ctx.orders.failDisputedDelivery).toHaveBeenCalledWith(
      'o1',
      'reason-1',
      expect.any(String),
      'admin-1'
    );
    expect(ctx.failed.resolveFailedDeliveryForActor).toHaveBeenCalledWith(
      'o1',
      expect.objectContaining({ resolution_type: 'agent_fault' }),
      { userId: 'admin-1', businessId: 'b1', locationId: '' }
    );
    expect(ctx.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();
    expect(r.outcome).toBe('supported');
  });

  it('refuses non-disputed orders and double resolution without moving money', async () => {
    const done = build('complete');
    await expect(done.svc.resolve('o1', { resolution: 'complete' })).rejects.toBeInstanceOf(HttpException);
    expect(done.orders.completeAfterClientConfirmation).not.toHaveBeenCalled();

    const raced = build();
    raced.orders.failDisputedDelivery.mockResolvedValue(false);
    await expect(raced.svc.resolve('o1', { resolution: 'client_fault' })).rejects.toBeInstanceOf(HttpException);
    expect(raced.failed.resolveFailedDeliveryForActor).not.toHaveBeenCalled();
    expect(raced.repo.resolveReports).not.toHaveBeenCalled();

    const racedComplete = build();
    racedComplete.orders.completeAfterClientConfirmation.mockResolvedValue({ alreadyComplete: true });
    await expect(racedComplete.svc.resolve('o1', { resolution: 'complete' })).rejects.toBeInstanceOf(HttpException);
    expect(racedComplete.repo.resolveReports).not.toHaveBeenCalled();
  });
});
