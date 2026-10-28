import { MtnMomoReconcilerService } from './mtn-momo-reconciler.service';

describe('MtnMomoReconcilerService', () => {
  const reconcile = jest.fn();
  let reconciler: MtnMomoReconcilerService;

  beforeEach(() => {
    reconcile.mockReset();
    reconciler = new MtnMomoReconcilerService({
      reconcilePendingPaymentRequests: reconcile,
    } as never);
  });

  it('polls payments older than a minute, at most 50', async () => {
    reconcile.mockResolvedValue({ checked: 0, updated: 0, errors: 0 });
    await reconciler.reconcilePendingPaymentRequests();
    expect(reconcile).toHaveBeenCalledWith({ minAgeSeconds: 60, limit: 50 });
  });

  it('skips a tick that overlaps a run still in flight', async () => {
    let release: (value: unknown) => void = () => undefined;
    reconcile.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const first = reconciler.reconcilePendingPaymentRequests();
    await reconciler.reconcilePendingPaymentRequests();
    expect(reconcile).toHaveBeenCalledTimes(1);
    release({ checked: 1, updated: 0, errors: 0 });
    await first;
    reconcile.mockResolvedValue({ checked: 0, updated: 0, errors: 0 });
    await reconciler.reconcilePendingPaymentRequests();
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it('clears the in-flight guard when the poll throws', async () => {
    reconcile.mockRejectedValueOnce(new Error('mtn down'));
    await reconciler.reconcilePendingPaymentRequests();
    reconcile.mockResolvedValue({ checked: 0, updated: 0, errors: 0 });
    await reconciler.reconcilePendingPaymentRequests();
    expect(reconcile).toHaveBeenCalledTimes(2);
  });
});
