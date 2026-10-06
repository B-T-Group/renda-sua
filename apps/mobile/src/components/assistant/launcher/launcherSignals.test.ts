import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetLauncherSignals,
  acquireLauncherSuppression,
  lastLauncherInteractionAt,
  launcherSuppressionCount,
  markLauncherInteraction,
  subscribeLauncherInteraction,
  subscribeLauncherSuppression,
} from './launcherSignals';

describe('launcher signals', () => {
  beforeEach(() => __resetLauncherSignals(0));

  it('counts overlapping overlays and releases idempotently', () => {
    const listener = vi.fn();
    const off = subscribeLauncherSuppression(listener);
    const a = acquireLauncherSuppression();
    const b = acquireLauncherSuppression();
    expect(launcherSuppressionCount()).toBe(2);
    a();
    a();
    expect(launcherSuppressionCount()).toBe(1);
    b();
    expect(launcherSuppressionCount()).toBe(0);
    expect(listener).toHaveBeenCalledTimes(4);
    off();
    acquireLauncherSuppression();
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('records the last interaction', () => {
    const listener = vi.fn();
    subscribeLauncherInteraction(listener);
    markLauncherInteraction(1234);
    expect(lastLauncherInteractionAt()).toBe(1234);
    expect(listener).toHaveBeenCalledOnce();
  });
});
