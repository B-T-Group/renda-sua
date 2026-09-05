import type {
  AdminOrderStatsAverages,
  AdminOrderStatsCounts,
  AdminOrderStatsRates,
} from './admin-orders.types';

export interface OrderStatusHistoryPoint {
  status: string;
  created_at: string;
}

/** Terminal-success order with the timestamps needed for duration math. */
export interface OrderDurationSample {
  created_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  actual_delivery_time: string | null;
  order_status_history?: OrderStatusHistoryPoint[] | null;
}

const MS_PER_MINUTE = 60_000;

function minutesBetween(
  from: string | null | undefined,
  to: string | null | undefined
): number | null {
  if (!from || !to) return null;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / MS_PER_MINUTE;
}

function firstHistoryAt(
  sample: OrderDurationSample,
  status: string
): string | null {
  const match = (sample.order_status_history ?? []).find(
    (point) => point.status === status
  );
  return match?.created_at ?? null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round(sum / values.length);
}

/** Merchant acceptance falls back to the confirmed history row on legacy orders. */
function acceptedAt(sample: OrderDurationSample): string | null {
  return sample.accepted_at ?? firstHistoryAt(sample, 'confirmed');
}

function prepStartedAt(sample: OrderDurationSample): string | null {
  return acceptedAt(sample) ?? firstHistoryAt(sample, 'preparing');
}

/** Older orders never set actual_delivery_time, so completion stands in for it. */
function deliveredAt(sample: OrderDurationSample): string | null {
  return sample.actual_delivery_time ?? sample.completed_at;
}

function collect(
  samples: OrderDurationSample[],
  duration: (sample: OrderDurationSample) => number | null
): number[] {
  return samples
    .map(duration)
    .filter((value): value is number => value !== null);
}

export function computeOrderStatsAverages(
  samples: OrderDurationSample[]
): AdminOrderStatsAverages {
  const completion = collect(samples, (s) =>
    minutesBetween(s.created_at, s.completed_at)
  );
  const acceptance = collect(samples, (s) =>
    minutesBetween(s.created_at, acceptedAt(s))
  );
  const prep = collect(samples, (s) =>
    minutesBetween(prepStartedAt(s), firstHistoryAt(s, 'ready_for_pickup'))
  );
  const delivery = collect(samples, (s) =>
    minutesBetween(firstHistoryAt(s, 'picked_up'), deliveredAt(s))
  );
  return {
    completion_minutes: average(completion),
    acceptance_minutes: average(acceptance),
    prep_minutes: average(prep),
    delivery_minutes: average(delivery),
    sample_size: samples.length,
    samples: {
      completion: completion.length,
      acceptance: acceptance.length,
      prep: prep.length,
      delivery: delivery.length,
    },
  };
}

/** Rates ignore unpaid orders so abandoned checkouts do not skew them. */
export function computeOrderStatsRates(
  counts: AdminOrderStatsCounts
): AdminOrderStatsRates {
  const settled = counts.total - counts.pending_payment;
  if (settled <= 0) {
    return { completion_rate: null, cancellation_rate: null };
  }
  const rate = (value: number) => Math.round((value / settled) * 1000) / 10;
  return {
    completion_rate: rate(counts.completed),
    cancellation_rate: rate(counts.cancelled),
  };
}
