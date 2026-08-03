import { isSetupMode, requiresMerchantAction } from './businessSetup';
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

  it('is false when storefront is already visible', () => {
    expect(
      isSetupMode(
        baseStatus({
          nextAction: 'setup_stripe_connect',
          requiresMerchantAction: true,
          is_storefront_visible: true,
          lifecycle_status: 'payment_setup_pending',
        })
      )
    ).toBe(false);
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
});
