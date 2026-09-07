/** Default delay before prompting a merchant to mark an ASAP order ready. */
export const DEFAULT_MARK_READY_DELAY_MINUTES = 15;
export const MIN_MARK_READY_DELAY_MINUTES = 5;
export const MAX_MARK_READY_DELAY_MINUTES = 120;
export const MIN_COMPLETED_ORDERS_FOR_AVG_PREP = 5;

export type PrepDurationSample = {
  accepted_at?: string | null;
  order_status_history?: Array<{ status: string; created_at: string }> | null;
};

function firstHistoryAt(
  sample: PrepDurationSample,
  status: string
): string | null {
  const match = (sample.order_status_history ?? []).find(
    (point) => point.status === status
  );
  return match?.created_at ?? null;
}

function prepStartedAt(sample: PrepDurationSample): string | null {
  return (
    sample.accepted_at ??
    firstHistoryAt(sample, 'confirmed') ??
    firstHistoryAt(sample, 'preparing')
  );
}

function minutesBetween(
  from: string | null | undefined,
  to: string | null | undefined
): number | null {
  if (!from || !to) return null;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / 60_000;
}

/** Measurable prep minutes: accepted/confirmed → first ready_for_pickup. */
export function collectPrepMinutes(samples: PrepDurationSample[]): number[] {
  return samples
    .map((sample) =>
      minutesBetween(
        prepStartedAt(sample),
        firstHistoryAt(sample, 'ready_for_pickup')
      )
    )
    .filter((value): value is number => value !== null);
}

export function clampMarkReadyDelayMinutes(minutes: number): number {
  return Math.min(
    MAX_MARK_READY_DELAY_MINUTES,
    Math.max(MIN_MARK_READY_DELAY_MINUTES, Math.round(minutes))
  );
}

/**
 * 15 minutes by default; use average prep when the business has enough
 * completed orders and measurable prep samples.
 */
export function resolveMarkReadyDelayMinutes(params: {
  completedOrderCount: number;
  prepSamples: PrepDurationSample[];
}): number {
  const prepMinutes = collectPrepMinutes(params.prepSamples);
  const canUseAverage =
    params.completedOrderCount >= MIN_COMPLETED_ORDERS_FOR_AVG_PREP &&
    prepMinutes.length >= MIN_COMPLETED_ORDERS_FOR_AVG_PREP;
  if (!canUseAverage) return DEFAULT_MARK_READY_DELAY_MINUTES;
  const average =
    prepMinutes.reduce((sum, value) => sum + value, 0) / prepMinutes.length;
  return clampMarkReadyDelayMinutes(average);
}
