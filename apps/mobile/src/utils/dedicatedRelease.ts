/**
 * #594 / #664: "Can't take this" for dedicated agents.
 * Pure helpers (no React) so the visibility, countdown and error mapping are unit tested.
 */

/** Same reasons the backend accepts for `POST /orders/offer/decline` and `POST /orders/:id/dedicated-release`. */
export const DEDICATED_DECLINE_REASONS = ['too_far', 'busy', 'not_enough_balance', 'other'] as const;
export type DedicatedDeclineReason = (typeof DEDICATED_DECLINE_REASONS)[number];

export interface DedicatedReleaseOrderFields {
  current_status?: string | null;
  assignment_source?: string | null;
  dedicated_release_until?: string | null;
}

/** Whole seconds left in the release window (0 when closed or unknown). The server stays the authority. */
export function releaseSecondsLeft(until: string | null | undefined, nowMs: number = Date.now()): number {
  if (!until) return 0;
  const t = new Date(until).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t - nowMs) / 1000));
}

/**
 * Show the button only for the agent's own auto-assigned order, still `assigned_to_agent`,
 * while `now < dedicated_release_until` (no client grace period).
 */
export function canShowDedicatedRelease(
  order: DedicatedReleaseOrderFields | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!order) return false;
  if (order.current_status !== 'assigned_to_agent') return false;
  if (order.assignment_source !== 'dedicated_auto') return false;
  return releaseSecondsLeft(order.dedicated_release_until, nowMs) > 0;
}

/** mm:ss */
export function formatReleaseCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export type DedicatedReleaseFailure =
  /** Hide the button; the order stays with the agent (flag off, not auto-assigned, window over). */
  | { kind: 'hide'; message: string | null }
  /** The order is no longer theirs / already picked up: refresh it. */
  | { kind: 'refresh'; message: string | null }
  /** Nothing changed server-side: offer "Try again" while the countdown is running. */
  | { kind: 'retry'; message: string | null }
  /** Anything else (unknown order, bad reason, network): show the message. */
  | { kind: 'other'; message: string | null };

/** Map a failed `POST /orders/:id/dedicated-release` (apiClient errors carry `code` and `status`). */
export function classifyDedicatedReleaseError(err: unknown): DedicatedReleaseFailure {
  const e = (err ?? {}) as { code?: string; status?: number; message?: string };
  const message = typeof e.message === 'string' && e.message.trim() ? e.message : null;
  switch (e.code) {
    case 'DEDICATED_DISABLED':
    case 'DEDICATED_RELEASE_NOT_AUTO_ASSIGNED':
    case 'DEDICATED_RELEASE_WINDOW_CLOSED':
      return { kind: 'hide', message };
    case 'DEDICATED_RELEASE_NOT_ASSIGNED':
    case 'DEDICATED_RELEASE_LOST':
      return { kind: 'refresh', message };
    case 'DEDICATED_RELEASE_FAILED':
      return { kind: 'retry', message };
    default:
      return e.status === 500 ? { kind: 'retry', message } : { kind: 'other', message };
  }
}
