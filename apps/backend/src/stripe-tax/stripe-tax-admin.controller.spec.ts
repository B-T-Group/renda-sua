import { StripeTaxAdminController } from './stripe-tax-admin.controller';

describe('StripeTaxAdminController.reconcile', () => {
  let lifecycle: { reconcileOrder: jest.Mock; reconcileBatch: jest.Mock };
  let controller: StripeTaxAdminController;

  beforeEach(() => {
    lifecycle = {
      reconcileOrder: jest.fn().mockResolvedValue({ orderNumber: 'ORD-1', finalize: 'would_finalize' }),
      reconcileBatch: jest.fn().mockResolvedValue({ scanned: 2, items: [] }),
    };
    controller = new StripeTaxAdminController({} as never, lifecycle as never);
  });

  it('is a dry run by default (body omitted, empty, or dryRun not exactly false)', async () => {
    for (const body of [undefined, {}, { dryRun: true }, { dryRun: 'false' as never }]) {
      await controller.reconcile(body as never);
    }
    expect(lifecycle.reconcileBatch.mock.calls.map((c) => c[0].dryRun)).toEqual([true, true, true, true]);
  });

  it('only writes with an explicit dryRun=false', async () => {
    await controller.reconcile({ dryRun: false });
    expect(lifecycle.reconcileBatch).toHaveBeenCalledWith({ dryRun: false, limit: 25 });
  });

  it('reconciles a single named order', async () => {
    const res = await controller.reconcile({ orderNumber: ' ORD-1 ' });
    expect(lifecycle.reconcileOrder).toHaveBeenCalledWith('ORD-1', { dryRun: true });
    expect(res).toMatchObject({ dryRun: true, scanned: 1 });
  });

  it('clamps the batch limit to 1..100', async () => {
    await controller.reconcile({ limit: 5000 });
    await controller.reconcile({ limit: -3 });
    await controller.reconcile({ limit: 0 });
    expect(lifecycle.reconcileBatch.mock.calls.map((c) => c[0].limit)).toEqual([100, 1, 25]);
  });
});
