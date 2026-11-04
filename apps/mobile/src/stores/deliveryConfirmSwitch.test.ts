import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACK_TOAST_MS, SWITCH_OVERLAY_MAX_MS, deliveryConfirmSwitch as s } from './deliveryConfirmSwitch';

describe('deliveryConfirmSwitch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    s.reset();
  });
  afterEach(() => vi.useRealTimers());

  it('overlay never outlives 1 s', () => {
    s.begin('agent');
    expect(s.get().switching).toBe(true);
    vi.advanceTimersByTime(SWITCH_OVERLAY_MAX_MS);
    expect(s.get().switching).toBe(false);
  });

  it('shows the back toast once, for 5 s, after a switch', () => {
    s.begin('business');
    expect(s.finish()).toBe(true);
    expect(s.get().toastPersona).toBe('business');
    vi.advanceTimersByTime(BACK_TOAST_MS);
    expect(s.get().toastPersona).toBeNull();
    expect(s.finish()).toBe(false);
    expect(s.get().toastPersona).toBeNull();
  });

  it('no toast without a switch; wrong account clears the overlay', () => {
    expect(s.finish()).toBe(false);
    s.begin('agent');
    s.showWrongAccount();
    expect(s.get()).toEqual(expect.objectContaining({ switching: false, wrongAccount: true }));
  });
});
