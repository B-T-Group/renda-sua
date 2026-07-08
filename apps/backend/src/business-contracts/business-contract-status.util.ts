import {
  ContractStatus,
  TERMINAL_CONTRACT_STATUSES,
} from './business-contracts.types';

const STATUS_RANK: Record<ContractStatus, number> = {
  not_sent: 0,
  sent: 1,
  viewed: 2,
  signed: 10,
  declined: 10,
  expired: 10,
  cancelled: 10,
  failed: 10,
};

export function isTerminalContractStatus(status: ContractStatus): boolean {
  return TERMINAL_CONTRACT_STATUSES.includes(status);
}

export function canTransitionContractStatus(
  from: ContractStatus,
  to: ContractStatus
): boolean {
  if (from === to) return true;
  if (isTerminalContractStatus(from)) return false;
  if (to === 'signed') return from === 'sent' || from === 'viewed';
  if (to === 'viewed') return from === 'sent';
  if (to === 'sent') return from === 'not_sent';
  if (to === 'failed') return from === 'not_sent' || from === 'sent';
  if (to === 'declined' || to === 'expired' || to === 'cancelled') {
    return from === 'sent' || from === 'viewed';
  }
  return STATUS_RANK[to] >= STATUS_RANK[from];
}

export function mapBoldSignEventToStatus(eventType: string): ContractStatus | null {
  const map: Record<string, ContractStatus> = {
    Sent: 'sent',
    Viewed: 'viewed',
    Signed: 'signed',
    Completed: 'signed',
    Declined: 'declined',
    Expired: 'expired',
    Revoked: 'cancelled',
    SendFailed: 'failed',
    DeliveryFailed: 'failed',
  };
  return map[eventType] ?? null;
}
