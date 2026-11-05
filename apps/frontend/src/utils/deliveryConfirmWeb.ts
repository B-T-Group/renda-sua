export type DeliveryConfirmSource = 'push' | 'wa' | 'sms' | 'in_app';
export type WebPersona = 'client' | 'agent' | 'business';

export function deliveryConfirmSource(raw: string | null): DeliveryConfirmSource {
  return raw === 'push' || raw === 'wa' || raw === 'sms' ? raw : 'in_app';
}

/** What the page must do before rendering any order data. */
export function personaPlan(params: {
  requested: string | null;
  active: WebPersona | null;
  personas: WebPersona[];
}): 'render' | 'switch' | 'wrong_account' {
  const target = params.requested === 'client' || !params.requested ? 'client' : null;
  if (!target) return 'wrong_account';
  if (params.active === target) return 'render';
  return params.personas.includes(target) ? 'switch' : 'wrong_account';
}

/** Minutes until the deadline, corrected for client/server clock skew. */
export function minutesLeft(
  deadlineAt: string | null | undefined,
  serverNow: string | null | undefined,
  fetchedAtMs: number,
  nowMs: number
): number | null {
  if (!deadlineAt) return null;
  const deadline = Date.parse(deadlineAt);
  if (Number.isNaN(deadline)) return null;
  const server = serverNow ? Date.parse(serverNow) : NaN;
  const skew = Number.isNaN(server) ? 0 : server - fetchedAtMs;
  return Math.max(0, Math.ceil((deadline - (nowMs + skew)) / 60_000));
}

/** Offline disables every action (no queueing); otherwise follow the server flags. */
export function confirmActions(
  state: { canComplete?: boolean; canReport?: boolean; canReportAfterCompletion?: boolean } | null,
  offline: boolean
): { complete: boolean; report: boolean; failed: boolean } {
  if (!state || offline) return { complete: false, report: false, failed: false };
  const report = !!state.canReport || !!state.canReportAfterCompletion;
  return { complete: !!state.canComplete, report, failed: report };
}

export function secondsSinceDelivered(deliveredAt: string | null | undefined, nowMs: number): number | null {
  if (!deliveredAt) return null;
  const t = Date.parse(deliveredAt);
  return Number.isNaN(t) ? null : Math.max(0, Math.round((nowMs - t) / 1000));
}
