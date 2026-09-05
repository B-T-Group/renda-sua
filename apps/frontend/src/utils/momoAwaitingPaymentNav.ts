export type MobileMoneyAwaitingSource = 'checkout' | 'pickup' | 'retry';

export type MobileMoneyAwaitingPaymentState = {
  orderIds: string[];
  phoneE164: string;
  source: MobileMoneyAwaitingSource;
  orderNumbers?: string[];
  /** Optional confirmation payload to resume after paid (checkout). */
  confirmationState?: Record<string, unknown>;
};

export function momoAwaitingStorageKey(orderIds: string[]): string {
  return `momoAwaiting:${orderIds.join(',')}`;
}

export function persistMomoAwaitingConfirmation(
  orderIds: string[],
  confirmationState?: Record<string, unknown>
): void {
  if (!confirmationState || !orderIds.length) return;
  try {
    sessionStorage.setItem(
      momoAwaitingStorageKey(orderIds),
      JSON.stringify(confirmationState)
    );
  } catch {
    // private mode / quota — poll still works from query params
  }
}

export function readMomoAwaitingConfirmation(
  orderIds: string[]
): Record<string, unknown> | undefined {
  if (!orderIds.length || typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(momoAwaitingStorageKey(orderIds));
    if (!raw) return undefined;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function splitCsv(value: string | null): string[] {
  return (value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseSource(value: string | undefined | null): MobileMoneyAwaitingSource {
  if (value === 'pickup' || value === 'retry' || value === 'checkout') return value;
  return 'checkout';
}

/** Build a refresh-safe location (query params + optional sessionStorage). */
export function buildMomoAwaitingPaymentTo(
  state: MobileMoneyAwaitingPaymentState
): {
  pathname: string;
  search: string;
  state: MobileMoneyAwaitingPaymentState;
} {
  persistMomoAwaitingConfirmation(state.orderIds, state.confirmationState);
  const params = new URLSearchParams();
  params.set('orderIds', state.orderIds.join(','));
  if (state.phoneE164) params.set('phone', state.phoneE164);
  params.set('source', state.source);
  if (state.orderNumbers?.length) {
    params.set('orderNumbers', state.orderNumbers.join(','));
  }
  return {
    pathname: '/orders/awaiting-payment',
    search: `?${params.toString()}`,
    state,
  };
}

/** Prefer URL query (survives refresh); fall back to location.state / sessionStorage. */
export function parseMomoAwaitingPaymentParams(
  search: string,
  locationState?: Partial<MobileMoneyAwaitingPaymentState> | null
): MobileMoneyAwaitingPaymentState {
  const query = new URLSearchParams(search);
  const fromQuery = splitCsv(query.get('orderIds'));
  const orderIds = fromQuery.length ? fromQuery : locationState?.orderIds ?? [];
  const phoneE164 = query.get('phone')?.trim() || locationState?.phoneE164 || '';
  const source = parseSource(query.get('source') || locationState?.source);
  const numbersQuery = splitCsv(query.get('orderNumbers'));
  const orderNumbers = numbersQuery.length
    ? numbersQuery
    : locationState?.orderNumbers;
  const confirmationState =
    locationState?.confirmationState || readMomoAwaitingConfirmation(orderIds);
  return { orderIds, phoneE164, source, orderNumbers, confirmationState };
}
