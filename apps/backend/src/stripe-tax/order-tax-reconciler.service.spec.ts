import { OrderTaxReconcilerService } from './order-tax-reconciler.service';

describe('OrderTaxReconcilerService', () => {
  const originalEnabled = process.env.ORDER_TAX_RECONCILER_ENABLED;
  const originalDryRun = process.env.ORDER_TAX_RECONCILER_DRY_RUN;
  let lifecycle: { reconcileBatch: jest.Mock };
  let service: OrderTaxReconcilerService;

  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  beforeEach(() => {
    delete process.env.ORDER_TAX_RECONCILER_ENABLED;
    delete process.env.ORDER_TAX_RECONCILER_DRY_RUN;
    lifecycle = { reconcileBatch: jest.fn().mockResolvedValue({ scanned: 0, items: [] }) };
    service = new OrderTaxReconcilerService(lifecycle as never);
  });
  afterEach(() => {
    restore('ORDER_TAX_RECONCILER_ENABLED', originalEnabled);
    restore('ORDER_TAX_RECONCILER_DRY_RUN', originalDryRun);
  });

  it('is ON by default but DRY-RUN (log only, no writes) with a bounded batch', async () => {
    await service.sweep();
    expect(lifecycle.reconcileBatch).toHaveBeenCalledTimes(1);
    expect(lifecycle.reconcileBatch).toHaveBeenCalledWith({ dryRun: true, limit: 25 });
  });

  it('stays dry-run for any DRY_RUN value other than the exact string "false"', async () => {
    for (const v of ['true', '0', 'no', '', 'FALSE']) {
      lifecycle.reconcileBatch.mockClear();
      process.env.ORDER_TAX_RECONCILER_DRY_RUN = v;
      await service.sweep();
      expect(lifecycle.reconcileBatch).toHaveBeenCalledWith({ dryRun: true, limit: 25 });
    }
  });

  it('writes only when ORDER_TAX_RECONCILER_DRY_RUN=false', async () => {
    process.env.ORDER_TAX_RECONCILER_DRY_RUN = 'false';
    await service.sweep();
    expect(lifecycle.reconcileBatch).toHaveBeenCalledWith({ dryRun: false, limit: 25 });
  });

  it('is switched off only by ORDER_TAX_RECONCILER_ENABLED=false', async () => {
    process.env.ORDER_TAX_RECONCILER_ENABLED = 'false';
    process.env.ORDER_TAX_RECONCILER_DRY_RUN = 'false';
    await service.sweep();
    expect(lifecycle.reconcileBatch).not.toHaveBeenCalled();
  });

  it('never overlaps itself and never throws', async () => {
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
