export const RETURN_ESCALATION_MS = 24 * 60 * 60 * 1000;

export type RenterReturnPhase = 'hidden' | 'due' | 'overdue' | 'waiting' | 'escalated';

export interface RenterReturnInput {
  status: string;
  endAt?: string | null;
  reportedAt?: string | null;
  escalatedAt?: string | null;
  now?: Date;
}

export function renterReturnPhase(input: RenterReturnInput): RenterReturnPhase {
  if (!isOpenReturn(input.status)) return 'hidden';
  const now = input.now ?? new Date();
  const pastDue = returnByPassed(input.endAt, now);
  if (input.status === 'active' && !pastDue) return 'hidden';
  if (!input.reportedAt) return pastDue ? 'overdue' : 'due';
  return escalated(input, now) ? 'escalated' : 'waiting';
}

export function listReturnChip(input: RenterReturnInput): 'overdue' | 'waiting' | null {
  if (!isOpenReturn(input.status)) return null;
  if (input.reportedAt) return escalated(input, input.now ?? new Date()) ? null : 'waiting';
  return returnByPassed(input.endAt, input.now ?? new Date()) ? 'overdue' : null;
}

export function formatDoualaStamp(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const french = language.toLowerCase().startsWith('fr');
  const day = new Intl.DateTimeFormat(french ? 'fr-FR' : 'en-GB', {
    timeZone: 'Africa/Douala',
    day: 'numeric',
    month: 'short',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Douala',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${day} · ${time}`;
}

function isOpenReturn(status: string): boolean {
  return status === 'active' || status === 'awaiting_return';
}

function returnByPassed(endAt: string | null | undefined, now: Date): boolean {
  const end = endAt ? new Date(endAt).getTime() : Number.NaN;
  return Number.isFinite(end) && end <= now.getTime();
}

function escalated(input: RenterReturnInput, now: Date): boolean {
  if (input.escalatedAt) return true;
  const reported = input.reportedAt ? new Date(input.reportedAt).getTime() : Number.NaN;
  return Number.isFinite(reported) && reported + RETURN_ESCALATION_MS <= now.getTime();
}
