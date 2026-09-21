import { cashAdvanceOwed, drawableRemaining } from './cashAdvance';

describe('cashAdvance utils', () => {
  it('computes remaining as limit minus abs(balance)', () => {
    expect(drawableRemaining(100_000, -25_000)).toBe(75_000);
    expect(drawableRemaining(100_000, 0)).toBe(100_000);
    expect(drawableRemaining(50_000, -50_000)).toBe(0);
  });

  it('never returns negative remaining', () => {
    expect(drawableRemaining(10_000, -15_000)).toBe(0);
  });

  it('handles string inputs and invalid limits', () => {
    expect(drawableRemaining('20000', '-5000')).toBe(15_000);
    expect(drawableRemaining(0, -100)).toBe(0);
    expect(drawableRemaining(null, -100)).toBe(0);
  });

  it('computes owed as absolute cash-advance balance', () => {
    expect(cashAdvanceOwed(-12_500)).toBe(12_500);
    expect(cashAdvanceOwed(0)).toBe(0);
    expect(cashAdvanceOwed(undefined)).toBe(0);
  });
});
