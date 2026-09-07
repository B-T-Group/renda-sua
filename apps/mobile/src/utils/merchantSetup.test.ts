import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessVerificationStatus } from '../services/businessVerificationApi';
import {
  goLiveStorageKey,
  hasCatalogItem,
  isSetupMode,
  markGoLiveCelebrated,
  requiresMerchantAction,
  shouldShowGoLiveCelebration,
} from './merchantSetup';

const storage = new Map<string, string>();

vi.mock('../services/storage/StorageService', () => ({
  default: {
    getString: async (key: string) => storage.get(key) ?? null,
    setString: async (key: string, value: string) => {
      storage.set(key, value);
    },
  },
}));

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
    expect(requiresMerchantAction(baseStatus({ nextAction: 'sign_agreement' }))).toBe(
      true
    );
    expect(
      requiresMerchantAction(baseStatus({ nextAction: 'setup_stripe_connect' }))
    ).toBe(true);
    expect(requiresMerchantAction(baseStatus({ nextAction: 'upload_id' }))).toBe(
      false
    );
    expect(requiresMerchantAction(baseStatus({ nextAction: 'pending_review' }))).toBe(
      false
    );
    expect(requiresMerchantAction(baseStatus({ nextAction: 'complete' }))).toBe(false);
  });

  it('returns false for null status', () => {
    expect(requiresMerchantAction(null)).toBe(false);
  });
});

describe('hasCatalogItem', () => {
  it('detects pending or approved catalog items', () => {
    expect(
      hasCatalogItem(
        baseStatus({
          steps: {
            agreement: { complete: true },
            catalog: { complete: false, hasPendingItem: true },
          },
        })
      )
    ).toBe(true);
    expect(
      hasCatalogItem(
        baseStatus({
          steps: {
            agreement: { complete: true },
            catalog: { complete: false },
          },
        })
      )
    ).toBe(false);
  });
});

describe('isSetupMode', () => {
  it('is false when suspended', () => {
    expect(
      isSetupMode(
        baseStatus({
          requiresMerchantAction: true,
          lifecycle_status: 'suspended',
        })
      )
    ).toBe(false);
  });

  it('is false when active / can accept orders', () => {
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

  it('uses isOnboarding when present', () => {
    expect(
      isSetupMode(
        baseStatus({
          nextAction: 'pending_review',
          isOnboarding: true,
          lifecycle_status: 'contract_signed',
        })
      )
    ).toBe(true);
  });

  it('is true for early merchant setup', () => {
    expect(
      isSetupMode(
        baseStatus({
          requiresMerchantAction: true,
          is_storefront_visible: false,
          lifecycle_status: 'created',
        })
      )
    ).toBe(true);
  });
});

describe('shouldShowGoLiveCelebration', () => {
  const businessId = 'biz-go-live-1';

  beforeEach(() => {
    storage.clear();
  });

  it('is true when can_accept_orders and not yet celebrated', async () => {
    await expect(
      shouldShowGoLiveCelebration(
        baseStatus({ can_accept_orders: true, nextAction: 'complete' }),
        businessId
      )
    ).resolves.toBe(true);
  });

  it('is false after dismiss is persisted', async () => {
    await markGoLiveCelebrated(businessId);
    expect(storage.get(goLiveStorageKey(businessId))).toBe('1');
    await expect(
      shouldShowGoLiveCelebration(
        baseStatus({ can_accept_orders: true, nextAction: 'complete' }),
        businessId
      )
    ).resolves.toBe(false);
  });

  it('is false when cannot accept orders', async () => {
    await expect(
      shouldShowGoLiveCelebration(
        baseStatus({ can_accept_orders: false }),
        businessId
      )
    ).resolves.toBe(false);
  });
});
