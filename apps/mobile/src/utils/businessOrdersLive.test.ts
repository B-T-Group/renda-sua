import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  businessOrdersLiveFingerprint,
  createLiveRefreshScheduler,
  shouldRefreshFromBusinessOrdersLive,
  type BusinessOrderLiveRow,
} from './businessOrdersLive';

const row = (
  id: string,
  status: string,
  payment: string | null = 'paid'
): BusinessOrderLiveRow => ({
  id,
  current_status: status,
  payment_status: payment,
  updated_at: '2026-10-05T12:00:00Z',
});

describe('businessOrdersLive', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds a stable fingerprint regardless of row order', () => {
    const first = businessOrdersLiveFingerprint([
      row('b', 'preparing'),
      row('a', 'pending', 'unpaid'),
    ]);
    const second = businessOrdersLiveFingerprint([
      row('a', 'pending', 'unpaid'),
      row('b', 'preparing'),
    ]);
    expect(first).toBe(second);
    expect(first).toContain('a:pending:unpaid:');
  });

  it('skips the first snapshot and ignores an unchanged fingerprint', () => {
    const initial = shouldRefreshFromBusinessOrdersLive({
      fingerprint: 'a:pending:unpaid:t1',
      previousFingerprint: null,
      hasSnapshot: false,
    });
    expect(initial.refresh).toBe(false);
    expect(initial.hasSnapshot).toBe(true);

    const same = shouldRefreshFromBusinessOrdersLive({
      fingerprint: initial.fingerprint,
      previousFingerprint: initial.fingerprint,
      hasSnapshot: initial.hasSnapshot,
    });
    expect(same.refresh).toBe(false);

    const changed = shouldRefreshFromBusinessOrdersLive({
      fingerprint: 'a:preparing:paid:t2',
      previousFingerprint: same.fingerprint,
      hasSnapshot: same.hasSnapshot,
    });
    expect(changed.refresh).toBe(true);
  });

  it('debounces refreshes and drops the snapshot that opens the socket', () => {
    vi.useFakeTimers();
    const onFire = vi.fn();
    const scheduler = createLiveRefreshScheduler(400, onFire);

    scheduler.push('a:pending:unpaid:t1');
    vi.advanceTimersByTime(400);
    expect(onFire).not.toHaveBeenCalled();

    scheduler.push('a:pending:unpaid:t1');
    scheduler.push('a:preparing:paid:t2');
    vi.advanceTimersByTime(399);
    expect(onFire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
  });
});
