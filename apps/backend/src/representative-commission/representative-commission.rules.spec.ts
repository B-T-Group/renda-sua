import {
  computeStatement,
  eligibleOrderAmount,
  growthBonusPercent,
  month3WeeklyPace,
  registrationsMeetObjective,
  uncollectedDeliveryAmount,
  type CommissionGrid,
} from './representative-commission.rules';

const tiers = [
  { minMonthlySales: 0, maxMonthlySales: 17319999, bonusPercent: 0 },
  { minMonthlySales: 17320000, maxMonthlySales: 39999999, bonusPercent: 0.5 },
  { minMonthlySales: 40000000, maxMonthlySales: 99999999, bonusPercent: 1 },
  { minMonthlySales: 100000000, maxMonthlySales: 199999999, bonusPercent: 1.5 },
  { minMonthlySales: 200000000, maxMonthlySales: null, bonusPercent: 2 },
];

function xafGrid(): CommissionGrid {
  return {
    currency: 'XAF',
    basePercent: 10,
    capPercent: 13,
    holdPercent: 10,
    holdDays: 90,
    registrationTarget: 40,
    objectiveThresholdPercent: 70,
    activationAmount: 4000,
    tiers,
  };
}

describe('representative commission rules', () => {
  it('subtracts a waived delivery fee and floors the order at zero', () => {
    expect(
      uncollectedDeliveryAmount({
        deliveryFeeWaived: true,
        baseDeliveryFee: 1000,
        perKmDeliveryFee: 500,
        firstOrderDiscount: 0,
      })
    ).toBe(1500);
    expect(eligibleOrderAmount(1000, 1500, 'XAF')).toBe(0);
    expect(eligibleOrderAmount(4000, 1500, 'XAF')).toBe(2500);
  });

  it('subtracts only the first-order discount when delivery was not waived', () => {
    expect(
      uncollectedDeliveryAmount({
        deliveryFeeWaived: false,
        baseDeliveryFee: 1000,
        perKmDeliveryFee: 200,
        firstOrderDiscount: 300,
      })
    ).toBe(300);
  });

  it('matches the contract monthly example', () => {
    const actual = computeStatement({
      eligible: 8_400_000,
      gmv: 48_000_000,
      registrations: 40,
      activationCount: 17,
      fastStartEarned: 0,
      quarterlyEarned: 0,
      grid: xafGrid(),
    });
    expect(actual.growthPercent).toBe(1);
    expect(actual.baseAmount).toBe(840_000);
    expect(actual.growthAmount).toBe(84_000);
    expect(actual.activationPaid).toBe(68_000);
    expect(actual.inCapTotal).toBe(992_000);
    expect(actual.payableAmount).toBe(892_800);
    expect(actual.holdAmount).toBe(99_200);
  });

  it('pays base only when registrations are under 70 percent', () => {
    const actual = computeStatement({
      eligible: 8_400_000,
      gmv: 48_000_000,
      registrations: 27,
      activationCount: 17,
      fastStartEarned: 120_000,
      quarterlyEarned: 100_000,
      grid: xafGrid(),
    });
    expect(registrationsMeetObjective(27, xafGrid())).toBe(false);
    expect(actual.growthAmount).toBe(0);
    expect(actual.activationPaid).toBe(0);
    expect(actual.fastStartPaid).toBe(0);
    expect(actual.baseAmount).toBe(840_000);
  });

  it('trims fast start after base so the total stays inside 13 percent', () => {
    const actual = computeStatement({
      eligible: 100_000,
      gmv: 0,
      registrations: 40,
      activationCount: 0,
      fastStartEarned: 120_000,
      quarterlyEarned: 0,
      grid: xafGrid(),
    });
    expect(actual.baseAmount).toBe(10_000);
    expect(actual.fastStartEarned).toBe(120_000);
    expect(actual.fastStartPaid).toBe(3_000);
    expect(actual.inCapTotal).toBe(13_000);
  });

  it('uses only the reached sales tier', () => {
    expect(growthBonusPercent(17_319_999, tiers)).toBe(0);
    expect(growthBonusPercent(17_320_000, tiers)).toBe(0.5);
    expect(growthBonusPercent(200_000_000, tiers)).toBe(2);
  });

  it('treats month 3 pace as sales times 7 over 30', () => {
    expect(month3WeeklyPace(17_142_858)).toBeGreaterThanOrEqual(4_000_000);
  });
});
