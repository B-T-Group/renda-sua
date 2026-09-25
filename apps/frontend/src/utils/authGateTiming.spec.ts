import { formatTimerMmSs, msUntil } from './authGateTiming';

describe('authGateTiming', () => {
  it('formats mm:ss', () => {
    expect(formatTimerMmSs(125_000)).toBe('2:05');
    expect(formatTimerMmSs(0)).toBe('0:00');
  });

  it('computes ms until iso timestamp', () => {
    const future = new Date(Date.now() + 5000).toISOString();
    expect(msUntil(future, 1000)).toBeGreaterThan(4000);
  });
});
