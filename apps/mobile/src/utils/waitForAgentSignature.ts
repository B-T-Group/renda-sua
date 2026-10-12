/**
 * After the agent says they signed, poll the agreement status until the BoldSign
 * webhook (or a refresh sync) marks it signed, for at most `timeoutMs`.
 * Stops early on a terminal status (declined, expired, cancelled, failed).
 */
export interface SignatureCheckSnapshot {
  signed: boolean;
  status: string | null;
}

export interface SignatureCheckResult extends SignatureCheckSnapshot {
  timedOut: boolean;
}

export const SIGNATURE_POLL_INTERVAL_MS = 3000;
export const SIGNATURE_POLL_TIMEOUT_MS = 60000;
export const TERMINAL_SIGNATURE_STATUSES = ['declined', 'expired', 'cancelled', 'failed'];

export const SIGNATURE_STATUS_KEYS = [
  'not_sent',
  'sent',
  'viewed',
  'declined',
  'expired',
  'cancelled',
  'failed',
] as const;

export function signatureStatusKey(status: string | null | undefined): string {
  const s = String(status || '').toLowerCase();
  return (SIGNATURE_STATUS_KEYS as readonly string[]).includes(s) ? s : 'unknown';
}

export async function waitForAgentSignature(
  check: () => Promise<SignatureCheckSnapshot>,
  opts: {
    intervalMs?: number;
    timeoutMs?: number;
    isCancelled?: () => boolean;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  } = {}
): Promise<SignatureCheckResult | null> {
  const interval = opts.intervalMs ?? SIGNATURE_POLL_INTERVAL_MS;
  const timeout = opts.timeoutMs ?? SIGNATURE_POLL_TIMEOUT_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? (() => Date.now());
  const started = now();
  let last: SignatureCheckSnapshot = { signed: false, status: null };
  for (;;) {
    if (opts.isCancelled?.()) return null;
    try {
      last = await check();
    } catch {
      // A failed poll is retried until the timeout; the last known status is kept.
    }
    if (opts.isCancelled?.()) return null;
    if (last.signed) return { ...last, timedOut: false };
    if (TERMINAL_SIGNATURE_STATUSES.includes(String(last.status))) {
      return { ...last, timedOut: false };
    }
    if (now() - started + interval > timeout) return { ...last, timedOut: true };
    await sleep(interval);
  }
}
