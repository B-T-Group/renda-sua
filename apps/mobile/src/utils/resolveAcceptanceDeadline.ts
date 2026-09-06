/** Active merchant acceptance SLA states that drive the accept countdown. */
const ACTIVE_ACCEPTANCE_SLA = new Set([
  'awaiting_acceptance',
  'no_response',
  'grace',
]);

/**
 * Returns a future acceptance/grace deadline only while the order is in an
 * active SLA. Scheduled / expired / missing deadlines return null so the UI
 * does not show a misleading "0s to accept" timer.
 */
export function resolveAcceptanceDeadline(
  details: {
    acceptance_state?: string | null;
    acceptance_deadline_at?: string | null;
    grace_deadline_at?: string | null;
  } | null,
  nowMs = Date.now()
): string | null {
  if (!details) return null;
  if (!ACTIVE_ACCEPTANCE_SLA.has(details.acceptance_state ?? '')) return null;
  const raw =
    details.grace_deadline_at || details.acceptance_deadline_at || null;
  if (!raw) return null;
  if (new Date(raw).getTime() <= nowMs) return null;
  return raw;
}
