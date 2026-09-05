import {
  computeOrderStatsAverages,
  computeOrderStatsRates,
  type OrderDurationSample,
} from './admin-order-stats.util';

const emptyCounts = {
  total: 0,
  completed: 0,
  in_progress: 0,
  cancelled: 0,
  failed: 0,
  refunds: 0,
  pending_payment: 0,
};

describe('admin-order-stats.util', () => {
  describe('computeOrderStatsAverages', () => {
    it('returns null averages when there is nothing to measure', () => {
      const actual = computeOrderStatsAverages([]);

      expect(actual.completion_minutes).toBeNull();
      expect(actual.prep_minutes).toBeNull();
      expect(actual.sample_size).toBe(0);
    });

    it('averages each duration from its own endpoints', () => {
      const samples: OrderDurationSample[] = [
        {
          created_at: '2026-08-01T10:00:00Z',
          accepted_at: '2026-08-01T10:05:00Z',
          completed_at: '2026-08-01T11:00:00Z',
          actual_delivery_time: '2026-08-01T10:55:00Z',
          order_status_history: [
            { status: 'confirmed', created_at: '2026-08-01T10:05:00Z' },
            { status: 'ready_for_pickup', created_at: '2026-08-01T10:25:00Z' },
            { status: 'picked_up', created_at: '2026-08-01T10:35:00Z' },
          ],
        },
        {
          created_at: '2026-08-02T10:00:00Z',
          accepted_at: '2026-08-02T10:15:00Z',
          completed_at: '2026-08-02T11:20:00Z',
          actual_delivery_time: null,
          order_status_history: [
            { status: 'ready_for_pickup', created_at: '2026-08-02T10:45:00Z' },
            { status: 'picked_up', created_at: '2026-08-02T11:00:00Z' },
          ],
        },
      ];

      const actual = computeOrderStatsAverages(samples);

      expect(actual.completion_minutes).toBe(70);
      expect(actual.acceptance_minutes).toBe(10);
      expect(actual.prep_minutes).toBe(25);
      // Second order has no actual_delivery_time, so completion stands in.
      expect(actual.delivery_minutes).toBe(20);
      expect(actual.samples).toEqual({
        completion: 2,
        acceptance: 2,
        prep: 2,
        delivery: 2,
      });
    });

    it('falls back to the confirmed history row when accepted_at is missing', () => {
      const actual = computeOrderStatsAverages([
        {
          created_at: '2026-08-01T10:00:00Z',
          accepted_at: null,
          completed_at: '2026-08-01T11:00:00Z',
          actual_delivery_time: null,
          order_status_history: [
            { status: 'confirmed', created_at: '2026-08-01T10:30:00Z' },
            { status: 'ready_for_pickup', created_at: '2026-08-01T10:50:00Z' },
          ],
        },
      ]);

      expect(actual.acceptance_minutes).toBe(30);
      expect(actual.prep_minutes).toBe(20);
    });

    it('skips orders missing an endpoint or with inverted timestamps', () => {
      const actual = computeOrderStatsAverages([
        {
          created_at: '2026-08-01T10:00:00Z',
          accepted_at: null,
          completed_at: null,
          actual_delivery_time: null,
          order_status_history: [],
        },
        {
          created_at: '2026-08-02T12:00:00Z',
          accepted_at: null,
          completed_at: '2026-08-02T11:00:00Z',
          actual_delivery_time: null,
          order_status_history: null,
        },
      ]);

      expect(actual.completion_minutes).toBeNull();
      expect(actual.sample_size).toBe(2);
      expect(actual.samples.completion).toBe(0);
    });
  });

  describe('computeOrderStatsRates', () => {
    it('excludes unpaid orders from the denominator', () => {
      const actual = computeOrderStatsRates({
        ...emptyCounts,
        total: 120,
        completed: 80,
        cancelled: 20,
        pending_payment: 20,
      });

      expect(actual.completion_rate).toBe(80);
      expect(actual.cancellation_rate).toBe(20);
    });

    it('returns null rates when nothing is settled', () => {
      const actual = computeOrderStatsRates({
        ...emptyCounts,
        total: 5,
        pending_payment: 5,
      });

      expect(actual).toEqual({
        completion_rate: null,
        cancellation_rate: null,
      });
    });
  });
});
