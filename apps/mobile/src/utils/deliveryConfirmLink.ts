import type { PersonaSlug } from '../types/persona';

export type DeliveryConfirmSource = 'push' | 'wa' | 'sms' | 'in_app';
export const DELIVERY_CONFIRM_SCREEN = 'delivery-confirm';

const CONFIRM_PATH = /^orders\/([0-9a-f-]{36})\/confirm\/?$/i;

/** `orders/:id/confirm` (app-relative path) → order id. */
export function deliveryConfirmOrderId(path: string): string | null {
  const m = CONFIRM_PATH.exec(path.replace(/^\//, ''));
  return m?.[1] ?? null;
}

/** `src=wa|sms|push` on a delivery-confirm URL; anything else is in-app. */
export function deliveryConfirmSourceFromUrl(url: string): DeliveryConfirmSource {
  try {
    const src = new URL(url).searchParams.get('src');
    if (src === 'wa' || src === 'sms' || src === 'push') return src;
  } catch {
    // ignore malformed URLs
  }
  return 'in_app';
}

export function isDeliveryConfirmPush(data: Record<string, unknown> | undefined): boolean {
  return !!data && data.screen === DELIVERY_CONFIRM_SCREEN;
}

export function parseTargetPersona(data: Record<string, unknown> | undefined): PersonaSlug | null {
  const raw = data?.targetPersona;
  return raw === 'client' || raw === 'agent' || raw === 'business' ? raw : null;
}

/** Remaining whole minutes to the server deadline, corrected for device clock skew. */
export function minutesLeft(params: {
  deadlineAt: string | null | undefined;
  serverNow: string | null | undefined;
  fetchedAtMs: number;
  nowMs: number;
}): number | null {
  if (!params.deadlineAt) return null;
  const deadline = Date.parse(params.deadlineAt);
  if (Number.isNaN(deadline)) return null;
  const server = params.serverNow ? Date.parse(params.serverNow) : NaN;
  const skew = Number.isNaN(server) ? 0 : server - params.fetchedAtMs;
  const left = deadline - (params.nowMs + skew);
  return Math.max(0, Math.ceil(left / 60_000));
}

export function formatHoursMinutes(totalMinutes: number): { h: number; m: number } {
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

export function secondsSinceDelivered(deliveredAt: string | null | undefined, nowMs: number): number | null {
  if (!deliveredAt) return null;
  const t = Date.parse(deliveredAt);
  return Number.isNaN(t) ? null : Math.max(0, Math.round((nowMs - t) / 1000));
}

export type ConfirmActions = { complete: boolean; report: boolean; failed: boolean };

/** Offline disables every action (no queueing); otherwise follow the server flags. */
export function deliveryConfirmActions(
  state: { canComplete?: boolean; canReport?: boolean; canReportAfterCompletion?: boolean } | null,
  offline: boolean
): ConfirmActions {
  if (!state || offline) return { complete: false, report: false, failed: false };
  const report = !!state.canReport || !!state.canReportAfterCompletion;
  return { complete: !!state.canComplete, report, failed: report };
}
