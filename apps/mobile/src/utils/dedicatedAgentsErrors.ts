import type { TFunction } from 'i18next';

export function mapDedicatedError(code: string, t: TFunction): string {
  const errorKey = `dedicatedAgents.errors.${code}`;
  return t(errorKey, t('dedicatedAgents.generic', 'Something went wrong'));
}

export function shouldHideOnError(status: number, code?: string): boolean {
  if (status === 404) return true;
  if (status === 403) {
    if (!code) return true;
    return code !== 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE';
  }
  return false;
}

export type GateReason = 'not_verified' | 'contract_unsigned' | 'suspended' | 'commercial_focus' | 'no_agent';

export function shouldShowGate(status: number, code: string, reason: string | null): boolean {
  if (status !== 403) return false;
  if (code !== 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE') return false;
  if (!reason) return false;
  const gateReasons: GateReason[] = ['not_verified', 'contract_unsigned', 'suspended'];
  return gateReasons.includes(reason as GateReason);
}
