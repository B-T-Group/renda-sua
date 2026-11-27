import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModalDismissWaiter } from './modalDismissWaiter';

describe('createModalDismissWaiter', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves when the Modal reports it was dismissed', async () => {
    vi.useFakeTimers();
    const waiter = createModalDismissWaiter(700);
    const done = vi.fn();
    void waiter.wait().then(done);
    await vi.advanceTimersByTimeAsync(100);
    expect(done).not.toHaveBeenCalled();
    waiter.onDismiss();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timer when onDismiss never fires', async () => {
    vi.useFakeTimers();
    const waiter = createModalDismissWaiter(700);
    const done = vi.fn();
    void waiter.wait().then(done);
    await vi.advanceTimersByTimeAsync(699);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('ignores a dismiss with nothing waiting', () => {
    expect(() => createModalDismissWaiter().onDismiss()).not.toThrow();
  });
});
