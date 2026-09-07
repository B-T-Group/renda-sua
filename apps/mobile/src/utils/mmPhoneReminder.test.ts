import { describe, expect, it } from 'vitest';
import type { BusinessVerificationStatus } from '../services/businessVerificationApi';
import {
  isMmPhoneReminderBlocking,
  resolveMmPhoneReminderVariant,
  shouldShowMmPhoneReminder,
} from './mmPhoneReminder';

function mmStatus(
  overrides: Partial<BusinessVerificationStatus> & {
    phoneComplete?: boolean;
    identityStatus?: 'missing' | 'pending' | 'approved' | 'rejected';
    hasApprovedItem?: boolean;
    hasApprovedRental?: boolean;
  } = {}
): BusinessVerificationStatus {
  const {
    phoneComplete = false,
    identityStatus = 'pending',
    hasApprovedItem = false,
    hasApprovedRental = false,
    ...rest
  } = overrides;
  return {
    is_verified: false,
    accountFullName: 'Test',
    nextAction: 'pending_review',
    paymentRail: 'mobile_money',
    can_accept_orders: false,
    lifecycle_status: 'contract_signed',
    steps: {
      agreement: { complete: true },
      identity: {
        complete: identityStatus === 'pending' || identityStatus === 'approved',
        status: identityStatus,
      },
      mobilePaymentPhone: { complete: phoneComplete },
      catalog: {
        complete: hasApprovedItem || hasApprovedRental,
        hasApprovedItem,
        hasApprovedRental,
      },
    },
    ...rest,
  };
}

describe('mmPhoneReminder', () => {
  it('hides when phone step is complete', () => {
    const status = mmStatus({ phoneComplete: true, identityStatus: 'approved' });
    expect(resolveMmPhoneReminderVariant(status)).toBeNull();
    expect(shouldShowMmPhoneReminder(status, false)).toBe(false);
  });

  it('shows soft reminder after setup when phone incomplete', () => {
    const status = mmStatus({ identityStatus: 'pending' });
    status.steps.mobilePaymentPhone = {
      complete: false,
      totalActiveLocations: 1,
      locationCountNeedingPhone: 1,
    };
    expect(resolveMmPhoneReminderVariant(status)).toBe('reminder');
    expect(shouldShowMmPhoneReminder(status, false)).toBe(true);
    expect(shouldShowMmPhoneReminder(status, true)).toBe(false);
  });

  it('becomes blocking when active with approved catalog items', () => {
    const status = mmStatus({
      identityStatus: 'approved',
      can_accept_orders: true,
      lifecycle_status: 'active',
      hasApprovedItem: true,
    });
    status.steps.mobilePaymentPhone = {
      complete: false,
      totalActiveLocations: 1,
      locationCountNeedingPhone: 1,
    };
    expect(isMmPhoneReminderBlocking(status)).toBe(true);
    expect(resolveMmPhoneReminderVariant(status)).toBe('blocking');
    expect(shouldShowMmPhoneReminder(status, true)).toBe(true);
  });

  it('stays soft when ID approved but no approved catalog yet', () => {
    const status = mmStatus({
      identityStatus: 'approved',
      can_accept_orders: true,
      lifecycle_status: 'active',
      hasApprovedItem: false,
    });
    status.steps.mobilePaymentPhone = {
      complete: false,
      totalActiveLocations: 1,
      locationCountNeedingPhone: 1,
    };
    expect(resolveMmPhoneReminderVariant(status)).toBe('reminder');
    expect(shouldShowMmPhoneReminder(status, true)).toBe(false);
  });

  it('hides when there are no active MoMo locations yet', () => {
    const status = mmStatus({
      identityStatus: 'approved',
      can_accept_orders: true,
      lifecycle_status: 'active',
      hasApprovedItem: true,
    });
    status.steps.mobilePaymentPhone = {
      complete: false,
      totalActiveLocations: 0,
      locationCountNeedingPhone: 0,
    };
    expect(resolveMmPhoneReminderVariant(status)).toBeNull();
  });

  it('shows when locations need a confirmed phone', () => {
    const status = mmStatus({
      identityStatus: 'approved',
      can_accept_orders: true,
      lifecycle_status: 'active',
      hasApprovedItem: true,
    });
    status.steps.mobilePaymentPhone = {
      complete: false,
      totalActiveLocations: 1,
      locationCountNeedingPhone: 1,
    };
    expect(resolveMmPhoneReminderVariant(status)).toBe('blocking');
  });

  it('ignores stripe rail', () => {
    const status = mmStatus({
      paymentRail: 'stripe',
      identityStatus: 'approved',
      hasApprovedItem: true,
    });
    expect(resolveMmPhoneReminderVariant(status)).toBeNull();
  });
});
