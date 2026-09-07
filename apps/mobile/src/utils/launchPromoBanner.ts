import StorageService from '../services/storage/StorageService';

/** Persist dismiss per business + promo claim so a new claim can show again. */
export function launchPromoDismissKey(
  businessId: string,
  claimedAt: string
): string {
  return `rendasua:business:${businessId}:launch-promo-dismissed:${claimedAt}`;
}

export async function isLaunchPromoDismissed(
  businessId: string,
  claimedAt: string
): Promise<boolean> {
  const value = await StorageService.getString(
    launchPromoDismissKey(businessId, claimedAt)
  );
  return value === '1';
}

export async function dismissLaunchPromo(
  businessId: string,
  claimedAt: string
): Promise<void> {
  await StorageService.setString(
    launchPromoDismissKey(businessId, claimedAt),
    '1'
  );
}
