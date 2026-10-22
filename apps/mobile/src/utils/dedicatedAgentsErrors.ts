import type { TFunction } from 'i18next';

export function mapDedicatedError(code: string, t: TFunction): string {
  const errorKey = `dedicatedAgents.errors.${code}`;
  return t(errorKey, t('dedicatedAgents.generic', 'Something went wrong'));
}

export function shouldHideOnError(status: number, code?: string, reason?: string): boolean {
  // 404 means feature is off
  if (status === 404) return true;
  // 403 should be handled elsewhere (gate or no_address prompt)
  return false;
}

export type GateReason = 'not_verified' | 'contract_unsigned' | 'suspended';

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
    default:
      return 'alert-circle';
  }
}
