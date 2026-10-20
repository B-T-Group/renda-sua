import {
  dedicatedBalanceIneligibleReason,
  dedicatedIneligibleReason,
  dedicatedProfileIneligibleReason,
  hasDedicatedCapacity,
  isDedicatedEligibleOrder,
  requiresBalanceCheck,
  type DedicatedAgentFacts,
  type DedicatedEligibilityContext,
} from './dedicated-eligibility.util';

const facts = (over: Partial<DedicatedAgentFacts> = {}): DedicatedAgentFacts => ({
  assignmentStatus: 'active',
  offTodayDate: null,
  isVerified: true,
  isInternal: false,
  agentStatus: 'active',
  focus: 'delivery',
  contractSigned: true,
  activeOrders: 0,
  outstandingDedicatedOffers: 0,
  ...over,
});
const ctx = (over: Partial<DedicatedEligibilityContext> = {}): DedicatedEligibilityContext => ({
  localToday: '2026-10-18',
  maxActiveOrders: 10,
  rail: 'mobile_money',
  verifiedAgentDelivery: false,
  ...over,
});

describe('dedicatedProfileIneligibleReason (AC-E2 / E5, one clause at a time)', () => {
  it('a fully eligible agent passes', () => {
    expect(dedicatedProfileIneligibleReason(facts(), ctx())).toBeNull();
  });

  it.each([
    ['paused assignment', facts({ assignmentStatus: 'paused' }), ctx(), 'assignment_not_active'],
    ['removed assignment', facts({ assignmentStatus: 'removed' }), ctx(), 'assignment_not_active'],
    ['Off today (local today)', facts({ offTodayDate: '2026-10-18' }), ctx(), 'off_today'],
    ['not verified', facts({ isVerified: false }), ctx(), 'not_verified'],
    ['contract not signed', facts({ contractSigned: false }), ctx(), 'contract_unsigned'],
    ['suspended', facts({ agentStatus: 'suspended' }), ctx(), 'suspended'],
    ['commercial-only focus', facts({ focus: 'commercial' }), ctx(), 'commercial_focus'],
    ['independent on verified_agent_delivery', facts(), ctx({ verifiedAgentDelivery: true }), 'internal_only'],
    ['9 active + 1 outstanding offer', facts({ activeOrders: 9, outstandingDedicatedOffers: 1 }), ctx(), 'at_capacity'],
    ['10 active', facts({ activeOrders: 10 }), ctx(), 'at_capacity'],
  ])('%s -> %s', (_name, f, c, reason) => {
    expect(dedicatedProfileIneligibleReason(f, c)).toBe(reason);
  });

  it.each([
    ['9 active + 0 offers', facts({ activeOrders: 9 })],
    ['0 active + 9 offers', facts({ outstandingDedicatedOffers: 9 })],
    ['Off today was yesterday (resets next local day)', facts({ offTodayDate: '2026-10-17' })],
    ['focus both', facts({ focus: 'both' })],
    ['internal on verified_agent_delivery', facts({ isInternal: true })],
  ])('%s -> eligible', (_name, f) => {
    expect(dedicatedProfileIneligibleReason(f, ctx({ verifiedAgentDelivery: f.isInternal }))).toBeNull();
  });

  it('uses the configured cap, not a literal 10', () => {
    expect(dedicatedProfileIneligibleReason(facts({ activeOrders: 5 }), ctx({ maxActiveOrders: 5 }))).toBe('at_capacity');
    expect(dedicatedProfileIneligibleReason(facts({ activeOrders: 4 }), ctx({ maxActiveOrders: 5 }))).toBeNull();
  });
});

describe('hasDedicatedCapacity', () => {
  it('is strictly less than the cap, counting active orders and outstanding dedicated offers', () => {
    expect(hasDedicatedCapacity(9, 0, 10)).toBe(true);
    expect(hasDedicatedCapacity(9, 1, 10)).toBe(false);
    expect(hasDedicatedCapacity(0, 10, 10)).toBe(false);
  });
});

describe('balance check (independent, non-Stripe)', () => {
  it('applies only to independents on a non-Stripe rail', () => {
    expect(requiresBalanceCheck(false, 'mobile_money')).toBe(true);
    expect(requiresBalanceCheck(false, 'stripe')).toBe(false);
    expect(requiresBalanceCheck(true, 'mobile_money')).toBe(false);
    expect(requiresBalanceCheck(true, 'stripe')).toBe(false);
  });

  it('balance = hold - 1 is short, balance = hold is enough, negative covers nothing', () => {
    expect(dedicatedBalanceIneligibleReason(3999, 4000)).toBe('insufficient_balance');
    expect(dedicatedBalanceIneligibleReason(4000, 4000)).toBeNull();
    expect(dedicatedBalanceIneligibleReason(-1, 0)).toBe('negative_balance');
    expect(dedicatedBalanceIneligibleReason(Number.NaN, 0)).toBe('negative_balance');
  });

  it('dedicatedIneligibleReason skips the money check for internal agents and Stripe', () => {
    const broke = { availableBalance: -500, holdAmount: 4000 };
    expect(dedicatedIneligibleReason(facts(), ctx(), broke)).toBe('negative_balance');
    expect(dedicatedIneligibleReason(facts(), ctx({ rail: 'stripe' }), broke)).toBeNull();
    expect(dedicatedIneligibleReason(facts({ isInternal: true }), ctx(), broke)).toBeNull();
    expect(dedicatedIneligibleReason(facts({ isVerified: false }), ctx({ rail: 'stripe' }), broke)).toBe('not_verified');
  });
});

describe('isDedicatedEligibleOrder (AC-E1)', () => {
  it('only scheduled orders with a delivery window', () => {
    expect(isDedicatedEligibleOrder({ fulfillmentTiming: 'scheduled', hasDeliveryWindow: true })).toBe(true);
    expect(isDedicatedEligibleOrder({ fulfillmentTiming: 'asap', hasDeliveryWindow: true })).toBe(false);
    expect(isDedicatedEligibleOrder({ fulfillmentTiming: null, hasDeliveryWindow: true })).toBe(false);
    expect(isDedicatedEligibleOrder({ fulfillmentTiming: 'scheduled', hasDeliveryWindow: false })).toBe(false);
  });

  it('dispatch can require a confirmed window (PE)', () => {
    const base = { fulfillmentTiming: 'scheduled', hasDeliveryWindow: true, requireConfirmedWindow: true };
    expect(isDedicatedEligibleOrder({ ...base, windowConfirmed: false })).toBe(false);
    expect(isDedicatedEligibleOrder({ ...base, windowConfirmed: null })).toBe(false);
    expect(isDedicatedEligibleOrder({ ...base, windowConfirmed: true })).toBe(true);
    expect(isDedicatedEligibleOrder({ ...base, requireConfirmedWindow: false, windowConfirmed: false })).toBe(true);
  });
});
