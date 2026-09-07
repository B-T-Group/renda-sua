import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessVerificationStatus } from '../services/businessVerificationApi';
import {
  isVerifiedBadgeTipDismissed,
  markVerifiedBadgeTipDismissed,
  shouldShowVerifiedBadgeTip,
  verifiedBadgeTipDismissKey,
} from './verifiedBadgeTip';

const storage = new Map<string, string>();

vi.mock('../services/storage/StorageService', () => ({
  default: {
    getString: async (key: string) => storage.get(key) ?? null,
    setString: async (key: string, value: string) => {
      storage.set(key, value);
    },
  },
}));

describe('verifiedBadgeTip', () => {
  const businessId = 'biz-tip-1';

  beforeEach(() => {
    storage.clear();
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

  it('hides when verified', () => {
    expect(
      shouldShowVerifiedBadgeTip(status({ is_verified: true }), businessId, false)
    ).toBe(false);
  });

  it('persists dismiss and hides while identity is rejected', async () => {
    await markVerifiedBadgeTipDismissed(businessId);
    expect(await isVerifiedBadgeTipDismissed(businessId)).toBe(true);
    expect(storage.get(verifiedBadgeTipDismissKey(businessId))).toBe('1');
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
});
