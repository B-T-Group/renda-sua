import type { BusinessVerificationStatus } from '../services/businessVerificationApi';
import StorageService from '../services/storage/StorageService';

export type MmPhoneReminderVariant = 'reminder' | 'blocking';

export const mmPhoneReminderDismissKey = (businessId: string) =>
  `rendasua:business:${businessId}:mm-phone-reminder-dismissed`;

export function isMmPhoneStepIncomplete(
  status: BusinessVerificationStatus | null | undefined
): boolean {
  if (!status || status.paymentRail !== 'mobile_money') return false;
  const phone = status.steps.mobilePaymentPhone;
  if (!phone || phone.complete === true) return false;
  // Backend marks complete=false when there are zero MoMo locations; nothing to link yet.
  const locationCount = phone.totalActiveLocations ?? 0;
  const needing =
    phone.locationCountNeedingPhone ?? phone.locationsWithItemsNeedingPhone ?? 0;
  if (locationCount === 0 && needing === 0) return false;
  return true;
}

/** Permanent once the account is active (ID approved) and catalog has approved items. */
export function isMmPhoneReminderBlocking(
  status: BusinessVerificationStatus | null | undefined
): boolean {
  if (!isMmPhoneStepIncomplete(status)) return false;
  const identityApproved = status?.steps.identity?.status === 'approved';
  const accountActive =
    identityApproved ||
    status?.can_accept_orders === true ||
    status?.lifecycle_status === 'active';
  const hasApprovedCatalog = Boolean(
    status?.steps.catalog?.hasApprovedItem ||
      status?.steps.catalog?.hasApprovedRental
  );
  return accountActive && hasApprovedCatalog;
}

export function resolveMmPhoneReminderVariant(
  status: BusinessVerificationStatus | null | undefined
): MmPhoneReminderVariant | null {
  if (!isMmPhoneStepIncomplete(status)) return null;
  return isMmPhoneReminderBlocking(status) ? 'blocking' : 'reminder';
}

/**
 * Whether the dashboard should show the phone reminder.
 * Blocking always shows; soft reminder respects local dismissal.
 */
export function shouldShowMmPhoneReminder(
  status: BusinessVerificationStatus | null | undefined,
  dismissed: boolean
): boolean {
  const variant = resolveMmPhoneReminderVariant(status);
  if (!variant) return false;
  if (variant === 'blocking') return true;
  return !dismissed;
}

export async function isMmPhoneReminderDismissed(
  businessId: string
): Promise<boolean> {
  const value = await StorageService.getString(
    mmPhoneReminderDismissKey(businessId)
  );
  return value === '1';
}

export async function markMmPhoneReminderDismissed(
  businessId: string
): Promise<void> {
  await StorageService.setString(mmPhoneReminderDismissKey(businessId), '1');
}
