import {
  DASHBOARD_COMPOSING_MIN_MS,
  hasSeenDashboardComposing,
  markDashboardComposingSeen,
  resetDashboardComposingSession,
} from './useDashboardComposingSession';

describe('dashboard composing session flags', () => {
  beforeEach(() => {
    resetDashboardComposingSession();
  });

  it('tracks seen personas in memory', () => {
    expect(hasSeenDashboardComposing('client')).toBe(false);
    markDashboardComposingSeen('client');
    expect(hasSeenDashboardComposing('client')).toBe(true);
    expect(hasSeenDashboardComposing('agent')).toBe(false);
  });

  it('exposes a minimum display duration', () => {
    expect(DASHBOARD_COMPOSING_MIN_MS).toBeGreaterThanOrEqual(1000);
  });
});
