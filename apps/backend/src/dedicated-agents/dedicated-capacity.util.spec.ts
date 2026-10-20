import { computeEffectiveCapacity } from './dedicated-capacity.util';

const base = { maxActiveOrders: 10, activeOrders: 3, isInternal: false, rail: 'mobile_money' as const };

describe('computeEffectiveCapacity', () => {
  it('internal agents and Stripe use only the order-count limit', () => {
    expect(computeEffectiveCapacity({ ...base, isInternal: true, availableBalance: -100, typicalHold: 5000 })).toBe(7);
    expect(computeEffectiveCapacity({ ...base, rail: 'stripe', availableBalance: 0, typicalHold: 5000 })).toBe(7);
  });

  it('independent on MoMo: min(10 - active - offers, floor(balance / typical hold))', () => {
    expect(computeEffectiveCapacity({ ...base, availableBalance: 12_000, typicalHold: 5000 })).toBe(2);
    expect(computeEffectiveCapacity({ ...base, availableBalance: 100_000, typicalHold: 5000 })).toBe(7);
    expect(computeEffectiveCapacity({ ...base, outstandingDedicatedOffers: 6, availableBalance: 100_000, typicalHold: 5000 })).toBe(1);
  });

  it('negative balance covers 0; zero balance with a real hold covers 0', () => {
    expect(computeEffectiveCapacity({ ...base, availableBalance: -1, typicalHold: 5000 })).toBe(0);
    expect(computeEffectiveCapacity({ ...base, availableBalance: 0, typicalHold: 5000 })).toBe(0);
  });

  it('unknown typical hold leaves the order-count limit; never negative', () => {
    expect(computeEffectiveCapacity({ ...base, availableBalance: 10, typicalHold: 0 })).toBe(7);
    expect(computeEffectiveCapacity({ ...base, activeOrders: 12, isInternal: true })).toBe(0);
  });
});
