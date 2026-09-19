import { currentPeriod } from './payment-schedule.periods';

describe('currentPeriod', () => {
  it('returns the period that contains now', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-10T00:00:00Z');
    const period = currentPeriod(start, 'weekly', now);
    expect(period?.start.toISOString()).toBe('2026-01-08T00:00:00.000Z');
    expect(period?.end.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('returns null before the assignment starts or after it ends', () => {
    const start = new Date('2026-02-01T00:00:00Z');
    expect(currentPeriod(start, 'monthly', new Date('2026-01-01T00:00:00Z'))).toBeNull();
    expect(
      currentPeriod(start, 'weekly', new Date('2026-03-01T00:00:00Z'), new Date('2026-02-15T00:00:00Z'))
    ).toBeNull();
  });
});
