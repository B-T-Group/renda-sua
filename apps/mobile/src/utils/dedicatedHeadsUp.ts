import type { DedicatedHeadsUpResponse } from '../services/dedicatedAgentsService';

export type HeadsUpCardState = 'hidden' | 'pending' | 'marked';

/** Early dedicated heads-up card: shown only while the order still waits for dispatch. */
export function headsUpCardState(headsUp: DedicatedHeadsUpResponse['headsUp'] | undefined): HeadsUpCardState {
  if (!headsUp || !headsUp.active) return 'hidden';
  return headsUp.status === 'unavailable' ? 'marked' : 'pending';
}

/** Local HH:mm of the dispatch gate, or null when it is unknown / already past. */
export function headsUpDispatchTime(dispatchReadyAt: string | null | undefined, now: Date = new Date()): string | null {
  if (!dispatchReadyAt) return null;
  const at = new Date(dispatchReadyAt);
  if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) return null;
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}
