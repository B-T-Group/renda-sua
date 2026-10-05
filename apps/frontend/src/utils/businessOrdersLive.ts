export const BUSINESS_ORDERS_LIVE_DEBOUNCE_MS = 400;

export const BUSINESS_LIVE_TERMINAL_STATUSES = [
  'delivered',
  'complete',
  'cancelled',
  'failed',
  'refunded',
] as const;

export interface BusinessOrderLiveRow {
  id: string;
  current_status: string | null;
  payment_status: string | null;
  updated_at: string | null;
}

export function businessOrdersLiveFingerprint(
  rows: BusinessOrderLiveRow[] | null | undefined
): string {
  if (!rows?.length) return '';
  return rows
    .map(
      (row) =>
        `${row.id}:${row.current_status ?? ''}:${row.payment_status ?? ''}:${row.updated_at ?? ''}`
    )
    .sort()
    .join('|');
}

export function shouldRefreshFromBusinessOrdersLive(input: {
  fingerprint: string;
  previousFingerprint: string | null;
  hasSnapshot: boolean;
}): { refresh: boolean; hasSnapshot: boolean; fingerprint: string } {
  if (!input.hasSnapshot) {
    return {
      refresh: false,
      hasSnapshot: true,
      fingerprint: input.fingerprint,
    };
  }
  if (input.fingerprint === input.previousFingerprint) {
    return {
      refresh: false,
      hasSnapshot: true,
      fingerprint: input.fingerprint,
    };
  }
  return {
    refresh: true,
    hasSnapshot: true,
    fingerprint: input.fingerprint,
  };
}

export function createLiveRefreshScheduler(
  delayMs: number,
  onFire: () => void
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hasSnapshot = false;
  let fingerprint: string | null = null;

  const push = (nextFingerprint: string) => {
    const decision = shouldRefreshFromBusinessOrdersLive({
      fingerprint: nextFingerprint,
      previousFingerprint: fingerprint,
      hasSnapshot,
    });
    hasSnapshot = decision.hasSnapshot;
    fingerprint = decision.fingerprint;
    if (!decision.refresh) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onFire();
    }, delayMs);
  };

  const cancel = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  };

  return { push, cancel };
}
