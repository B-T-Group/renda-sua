import type { AccountInfoRow } from '../types/accountWallet';

/** Personal / legacy wallet: not tied to a specific business location. */
export function isLegacyWallet(
  account: Pick<AccountInfoRow, 'business_location_id'>
): boolean {
  return account.business_location_id == null;
}
