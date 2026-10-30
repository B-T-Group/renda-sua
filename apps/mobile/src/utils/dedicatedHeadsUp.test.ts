import { headsUpCardState, headsUpDispatchTime } from './dedicatedHeadsUp';

describe('headsUpCardState', () => {
  it('hides without a heads-up or once the order left dispatch', () => {
    expect(headsUpCardState(null)).toBe('hidden');
    expect(headsUpCardState({ status: 'sent', dispatchReadyAt: null, active: false })).toBe('hidden');
  });
  it('is pending until the agent answers, then marked', () => {
    expect(headsUpCardState({ status: 'sent', dispatchReadyAt: null, active: true })).toBe('pending');
    expect(headsUpCardState({ status: 'unavailable', dispatchReadyAt: null, active: true })).toBe('marked');
  });
});

describe('headsUpDispatchTime', () => {
  const now = new Date(2026, 9, 30, 9, 0);
  it('formats a future gate as HH:mm', () => {
    expect(headsUpDispatchTime(new Date(2026, 9, 30, 11, 5).toISOString(), now)).toBe('11:05');
  });
  it('is null when missing, invalid or past', () => {
    expect(headsUpDispatchTime(null, now)).toBeNull();
    expect(headsUpDispatchTime('nope', now)).toBeNull();
    expect(headsUpDispatchTime(new Date(2026, 9, 30, 8, 0).toISOString(), now)).toBeNull();
  });
});
