import type { TFunction } from 'i18next';

export function mapDedicatedError(code: string, t: TFunction): string {
  const errorKey = `dedicatedAgents.errors.${code}`;
  return t(errorKey, t('dedicatedAgents.generic', 'Something went wrong'));
}

export function shouldHideOnError(status: number, code?: string, reason?: string): boolean {
  // 404 means feature is off
  if (status === 404) return true;
  if (status === 403) {
    if (!code) return true;
    if (code !== 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE') return false;
    // Hide only on commercial_focus and no_agent
    if (reason === 'commercial_focus' || reason === 'no_agent') return true;
    // Don't hide on no_address - show the "Add your address" prompt instead
    return false;
  }
  return false;
}

export type GateReason = 'not_verified' | 'contract_unsigned' | 'suspended' | 'commercial_focus' | 'no_agent' | 'no_address';

export function shouldShowGate(status: number, code: string, reason: string | null): boolean {
  if (status !== 403) return false;
  if (code !== 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE') return false;
  // Never default to a gate if reason is missing
  if (!reason) return false;
  // Show gates for these specific reasons (no_address shows empty state with prompt, not a gate)
  const gateReasons: GateReason[] = ['not_verified', 'contract_unsigned', 'suspended'];
  return gateReasons.includes(reason as GateReason);
}

export function getGateIcon(reason: GateReason): string {
  switch (reason) {
    case 'not_verified':
      return 'shield-check';
    case 'contract_unsigned':
      return 'file-document-edit';
    case 'suspended':
      return 'alert-circle';
    case 'commercial_focus':
      return 'storefront';
    case 'no_agent':
      return 'account-off';
    case 'no_address':
      return 'map-marker-plus';
    default:
      return 'alert-circle';
  }
}
