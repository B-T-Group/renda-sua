import {
  isSetupMode,
  markGoLiveCelebrated,
  requiresMerchantAction,
  shouldShowGoLiveCelebration,
} from './businessSetup';
import type { BusinessVerificationStatus } from '../hooks/useBusinessVerification';

function baseStatus(
  overrides: Partial<BusinessVerificationStatus> = {}
): BusinessVerificationStatus {
  return {
    is_verified: false,
    accountFullName: 'Test Merchant',
    nextAction: 'sign_agreement',
    steps: {
      agreement: { complete: false },
    },
    ...overrides,
  };
}

describe('requiresMerchantAction', () => {
  it('uses server flag when present', () => {
    expect(
      requiresMerchantAction(
        baseStatus({
          nextAction: 'pending_review',
          requiresMerchantAction: true,
        })
      )
    ).toBe(true);
    expect(
      requiresMerchantAction(
        baseStatus({
          nextAction: 'sign_agreement',
          requiresMerchantAction: false,
        })
      )
    ).toBe(false);
  });

  it('falls back to nextAction when flag missing', () => {
    expect(requiresMerchantAction(baseStatus({ nextAction: 'upload_id' }))).toBe(
      true
    );
    expect(
      requiresMerchantAction(baseStatus({ nextAction: 'pending_review' }))
    ).toBe(false);
    expect(
      requiresMerchantAction(
        baseStatus({ nextAction: 'verify_mobile_payment_phone' })
      )
    ).toBe(false);
    expect(
      requiresMerchantAction(baseStatus({ nextAction: 'publish_catalog' }))
    ).toBe(false);
  });
});

describe('isSetupMode', () => {
  it('is false when suspended even if merchant action remains', () => {
    expect(
      isSetupMode(
        baseStatus({
          nextAction: 'sign_agreement',
          requiresMerchantAction: true,
          lifecycle_status: 'suspended',
        })
      )
    ).toBe(false);
  });

  it('is false when active', () => {
    expect(
      isSetupMode(
        baseStatus({
          nextAction: 'complete',
          isOnboarding: false,
          can_accept_orders: true,
          lifecycle_status: 'active',
        })
      )
    ).toBe(false);
  });

  it('stays in setup during pending review while onboarding', () => {
    expect(
      isSetupMode(
        baseStatus({
          nextAction: 'pending_review',
          isOnboarding: true,
          lifecycle_status: 'contract_signed',
          is_storefront_visible: true,
        })
      )
    ).toBe(true);
  });

  it('is true for early merchant setup', () => {
    expect(
      isSetupMode(
        baseStatus({
          nextAction: 'sign_agreement',
          requiresMerchantAction: true,
          is_storefront_visible: false,
          lifecycle_status: 'created',
        })
      )
    ).toBe(true);
  });

  it('exits setup when server marks MoMo onboarding complete during ID review', () => {
    expect(
      isSetupMode(
        baseStatus({
          nextAction: 'pending_review',
          isOnboarding: false,
          lifecycle_status: 'payment_verification_pending',
          can_accept_orders: false,
        })
      )
    ).toBe(false);
  });

  it('falls back to can_accept_orders when isOnboarding is absent', () => {
    expect(
      isSetupMode(
        baseStatus({
          nextAction: 'complete',
          can_accept_orders: true,
          lifecycle_status: 'catalog_ready',
        })
      )
    ).toBe(false);
  });
});

describe('shouldShowGoLiveCelebration', () => {
  const businessId = 'biz-go-live-1';

  beforeEach(() => {
    localStorage.removeItem(`rendasua:business:${businessId}:go-live-celebrated`);
  });

  it('is true when can_accept_orders and not yet celebrated', () => {
    expect(
      shouldShowGoLiveCelebration(
        baseStatus({ can_accept_orders: true, nextAction: 'complete' }),
        businessId
      )
    ).toBe(true);
  });

  it('is false after dismiss is persisted', () => {
    markGoLiveCelebrated(businessId);
    expect(
      shouldShowGoLiveCelebration(
        baseStatus({ can_accept_orders: true, nextAction: 'complete' }),
        businessId
      )
    ).toBe(false);
  });

  it('is false when cannot accept orders', () => {
    expect(
      shouldShowGoLiveCelebration(
        baseStatus({ can_accept_orders: false }),
        businessId
      )
    ).toBe(false);
  });
});
