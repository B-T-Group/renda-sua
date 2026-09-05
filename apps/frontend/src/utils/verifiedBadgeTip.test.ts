import {
  isVerifiedBadgeTipDismissed,
  markVerifiedBadgeTipDismissed,
  shouldShowVerifiedBadgeTip,
  verifiedBadgeTipDismissKey,
} from './verifiedBadgeTip';
import type { BusinessVerificationStatus } from '../hooks/useBusinessVerification';

describe('verifiedBadgeTip', () => {
  const businessId = 'biz-tip-1';

  beforeEach(() => {
    localStorage.removeItem(verifiedBadgeTipDismissKey(businessId));
  });

  function status(
    overrides: Partial<BusinessVerificationStatus> = {}
  ): BusinessVerificationStatus {
    return {
      is_verified: false,
      accountFullName: 'Ada',
      nextAction: 'complete',
      can_accept_orders: true,
      paymentRail: 'mobile_money',
      steps: { agreement: { complete: true }, identity: { status: 'missing' } },
      ...overrides,
    };
  }

  it('shows for active MM merchants without badge', () => {
    expect(shouldShowVerifiedBadgeTip(status(), businessId, false)).toBe(true);
  });

  it('hides when verified or cannot accept orders', () => {
    expect(
      shouldShowVerifiedBadgeTip(
        status({ is_verified: true }),
        businessId,
        false
      )
    ).toBe(false);
    expect(
      shouldShowVerifiedBadgeTip(
        status({ can_accept_orders: false }),
        businessId,
        false
      )
    ).toBe(false);
  });

  it('hides while identity is pending', () => {
    expect(
      shouldShowVerifiedBadgeTip(
        status({
          steps: {
            agreement: { complete: true },
            identity: { status: 'pending' },
          },
        }),
        businessId,
        false
      )
    ).toBe(false);
  });

  it('respects dismiss and hides while identity is rejected', () => {
    markVerifiedBadgeTipDismissed(businessId);
    expect(isVerifiedBadgeTipDismissed(businessId)).toBe(true);
    expect(shouldShowVerifiedBadgeTip(status(), businessId, true)).toBe(false);
    expect(
      shouldShowVerifiedBadgeTip(
        status({
          steps: {
            agreement: { complete: true },
            identity: { status: 'rejected' },
          },
        }),
        businessId,
        false
      )
    ).toBe(false);
  });

  it('shows Stripe tip when Connect is incomplete', () => {
    expect(
      shouldShowVerifiedBadgeTip(
        status({
          paymentRail: 'stripe',
          steps: {
            agreement: { complete: true },
            stripeConnect: { complete: false },
          },
        }),
        businessId,
        false
      )
    ).toBe(true);
  });
});
