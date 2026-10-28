import { OrderTaxReconcilerService } from './order-tax-reconciler.service';

describe('OrderTaxReconcilerService', () => {
  const original = process.env.ORDER_TAX_RECONCILER_ENABLED;
  let lifecycle: { reconcileBatch: jest.Mock };
  let service: OrderTaxReconcilerService;

  beforeEach(() => {
    lifecycle = { reconcileBatch: jest.fn().mockResolvedValue({ scanned: 0, items: [] }) };
    service = new OrderTaxReconcilerService(lifecycle as never);
  });
  afterEach(() => {
    if (original === undefined) delete process.env.ORDER_TAX_RECONCILER_ENABLED;
    else process.env.ORDER_TAX_RECONCILER_ENABLED = original;
  });

  it('is OFF unless ORDER_TAX_RECONCILER_ENABLED=true', async () => {
    delete process.env.ORDER_TAX_RECONCILER_ENABLED;
    await service.sweep();
    process.env.ORDER_TAX_RECONCILER_ENABLED = '1';
    await service.sweep();
    expect(lifecycle.reconcileBatch).not.toHaveBeenCalled();
  });

  it('sweeps for real (not dry-run) with a bounded batch when enabled', async () => {
    process.env.ORDER_TAX_RECONCILER_ENABLED = 'true';
    await service.sweep();
    expect(lifecycle.reconcileBatch).toHaveBeenCalledWith({ dryRun: false, limit: 25 });
  });

  it('never overlaps itself and never throws', async () => {
    process.env.ORDER_TAX_RECONCILER_ENABLED = 'true';
    let release: () => void = () => undefined;
    lifecycle.reconcileBatch.mockReturnValue(new Promise<void>((r) => (release = r)));
    const first = service.sweep();
    await service.sweep(); // skipped: first still running
    expect(lifecycle.reconcileBatch).toHaveBeenCalledTimes(1);
    release();
    await first;

    lifecycle.reconcileBatch.mockRejectedValue(new Error('hasura'));
    await expect(service.sweep()).resolves.toBeUndefined();
    // the failure released the lock
    lifecycle.reconcileBatch.mockResolvedValue({ scanned: 0, items: [] });
    await service.sweep();
    expect(lifecycle.reconcileBatch).toHaveBeenCalledTimes(3);
  });
});
