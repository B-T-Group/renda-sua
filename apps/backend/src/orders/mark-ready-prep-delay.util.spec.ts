import {
  DEFAULT_MARK_READY_DELAY_MINUTES,
  resolveMarkReadyDelayMinutes,
} from './mark-ready-prep-delay.util';

describe('resolveMarkReadyDelayMinutes', () => {
  it('defaults to 15 minutes without enough completed orders', () => {
    expect(
      resolveMarkReadyDelayMinutes({
        completedOrderCount: 4,
        prepSamples: [],
      })
    ).toBe(DEFAULT_MARK_READY_DELAY_MINUTES);
  });

  it('uses average prep when there are at least 5 samples', () => {
    const samples = Array.from({ length: 5 }, (_, i) => ({
      accepted_at: '2026-01-01T10:00:00.000Z',
      order_status_history: [
        {
          status: 'ready_for_pickup',
          created_at: `2026-01-01T10:${String(20 + i).padStart(2, '0')}:00.000Z`,
        },
      ],
    }));
    const minutes = resolveMarkReadyDelayMinutes({
      completedOrderCount: 5,
      prepSamples: samples,
    });
    expect(minutes).toBe(22);
  });

  it('clamps very short averages to 5 minutes', () => {
    const samples = Array.from({ length: 5 }, () => ({
      accepted_at: '2026-01-01T10:00:00.000Z',
      order_status_history: [
        { status: 'ready_for_pickup', created_at: '2026-01-01T10:01:00.000Z' },
      ],
    }));
    expect(
      resolveMarkReadyDelayMinutes({
        completedOrderCount: 10,
        prepSamples: samples,
      })
    ).toBe(5);
  });
});
