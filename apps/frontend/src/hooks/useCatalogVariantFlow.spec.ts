import { runAfterAuthGuard } from './useCatalogVariantFlow';

describe('runAfterAuthGuard', () => {
  it('runs the order action when a signed-in guard returns true without calling run', async () => {
    const run = jest.fn();

    const ok = await runAfterAuthGuard(() => true, run);

    expect(ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs the order action once when the guard calls run itself', async () => {
    const run = jest.fn();

    const ok = await runAfterAuthGuard((next) => {
      void next();
      return true;
    }, run);

    expect(ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not run the order action when auth is refused', async () => {
    const run = jest.fn();

    const ok = await runAfterAuthGuard(() => false, run);

    expect(ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});
