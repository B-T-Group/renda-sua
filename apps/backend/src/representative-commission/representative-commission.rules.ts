export interface CommissionGridTier {
  minMonthlySales: number;
  maxMonthlySales: number | null;
  bonusPercent: number;
}

export interface CommissionGrid {
  currency: string;
  basePercent: number;
  capPercent: number;
  holdPercent: number;
  holdDays: number;
  registrationTarget: number;
  objectiveThresholdPercent: number;
  activationAmount: number;
  tiers: CommissionGridTier[];
}

export interface StatementInput {
  eligible: number;
  gmv: number;
  registrations: number;
  activationCount: number;
  fastStartEarned: number;
  quarterlyEarned: number;
  grid: CommissionGrid;
}

export interface StatementMath {
  objectiveMet: boolean;
  growthPercent: number;
  baseAmount: number;
  growthAmount: number;
  activationEarned: number;
  activationPaid: number;
  fastStartEarned: number;
  fastStartPaid: number;
  quarterlyEarned: number;
  quarterlyPaid: number;
  inCapTotal: number;
  payableAmount: number;
  holdAmount: number;
}

export function roundGridAmount(amount: number, currency: string): number {
  if (currency === 'CAD' || currency === 'USD') {
    return Math.round(amount * 100) / 100;
  }
  return Math.round(amount);
}

export function uncollectedDeliveryAmount(input: {
  deliveryFeeWaived: boolean;
  baseDeliveryFee: number;
  perKmDeliveryFee: number;
  firstOrderDiscount: number;
}): number {
  if (input.deliveryFeeWaived) {
    return Math.max(0, input.baseDeliveryFee + input.perKmDeliveryFee);
  }
  return Math.max(0, input.firstOrderDiscount);
}

export function eligibleOrderAmount(
  itemCommission: number,
  uncollectedDelivery: number,
  currency: string
): number {
  const net = itemCommission - uncollectedDelivery;
  return roundGridAmount(Math.max(0, net), currency);
}

export function growthBonusPercent(
  gmv: number,
  tiers: CommissionGridTier[]
): number {
  const match = [...tiers]
    .sort((a, b) => a.minMonthlySales - b.minMonthlySales)
    .filter((tier) => inTier(gmv, tier))
    .pop();
  return match?.bonusPercent ?? 0;
}

export function registrationsMeetObjective(
  registrations: number,
  grid: Pick<CommissionGrid, 'registrationTarget' | 'objectiveThresholdPercent'>
): boolean {
  const needed = (grid.registrationTarget * grid.objectiveThresholdPercent) / 100;
  return registrations >= needed;
}

export function month3WeeklyPace(salesInWindow: number): number {
  return (salesInWindow * 7) / 30;
}

export function computeStatement(input: StatementInput): StatementMath {
  const met = registrationsMeetObjective(input.registrations, input.grid);
  const growthPercent = met ? growthBonusPercent(input.gmv, input.grid.tiers) : 0;
  const parts = statementParts(input, met, growthPercent);
  const capped = capParts(parts, input.eligible, input.grid);
  return statementFromParts(input, met, growthPercent, capped);
}

function inTier(gmv: number, tier: CommissionGridTier): boolean {
  if (gmv < tier.minMonthlySales) return false;
  return tier.maxMonthlySales == null || gmv <= tier.maxMonthlySales;
}

function percentOf(amount: number, percent: number, currency: string): number {
  if (amount <= 0 || percent <= 0) return 0;
  return roundGridAmount((amount * percent) / 100, currency);
}

function statementParts(
  input: StatementInput,
  met: boolean,
  growthPercent: number
): number[] {
  const currency = input.grid.currency;
  const base = percentOf(input.eligible, input.grid.basePercent, currency);
  const growth = percentOf(input.eligible, growthPercent, currency);
  const activation = met ? input.activationCount * input.grid.activationAmount : 0;
  return [base, growth, activation, met ? input.fastStartEarned : 0, met ? input.quarterlyEarned : 0];
}

function capParts(
  parts: number[],
  eligible: number,
  grid: CommissionGrid
): number[] {
  const cap = percentOf(eligible, grid.capPercent, grid.currency);
  let room = cap;
  return parts.map((part) => {
    const paid = roundGridAmount(Math.min(part, Math.max(0, room)), grid.currency);
    room -= paid;
    return paid;
  });
}

function statementFromParts(
  input: StatementInput,
  met: boolean,
  growthPercent: number,
  parts: number[]
): StatementMath {
  const inCap = parts.reduce((sum, part) => sum + part, 0);
  const hold = percentOf(inCap, input.grid.holdPercent, input.grid.currency);
  return {
    objectiveMet: met,
    growthPercent,
    baseAmount: parts[0],
    growthAmount: parts[1],
    activationEarned: met ? input.activationCount * input.grid.activationAmount : 0,
    activationPaid: parts[2],
    fastStartEarned: met ? input.fastStartEarned : 0,
    fastStartPaid: parts[3],
    quarterlyEarned: met ? input.quarterlyEarned : 0,
    quarterlyPaid: parts[4],
    inCapTotal: roundGridAmount(inCap, input.grid.currency),
    holdAmount: hold,
    payableAmount: roundGridAmount(inCap - hold, input.grid.currency),
  };
}
