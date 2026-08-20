import { DateTime } from 'luxon';
import { OrderRiskService, RiskLevel } from './order-risk.service';

describe('OrderRiskService', () => {
  const service = new OrderRiskService();

  it('flags ready_for_pickup stuck for months as critical', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-20T00:00:00.000Z'));
    const result = service.calculateRiskScore({
      current_status: 'ready_for_pickup',
      created_at: '2025-09-13T12:18:44.833Z',
      updated_at: '2025-09-13T12:30:46.160Z',
    });
    jest.useRealTimers();

    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(service.getRiskLevel(result.score)).toBe(RiskLevel.CRITICAL);
    expect(result.factors.some((f) => f.includes('ready_for_pickup'))).toBe(
      true
    );
  });

  it('flags ready_for_pickup stuck ~30 hours as high', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-20T12:00:00.000Z'));
    const result = service.calculateRiskScore({
      current_status: 'ready_for_pickup',
      updated_at: '2026-08-19T06:00:00.000Z',
    });
    jest.useRealTimers();

    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(service.getRiskLevel(result.score)).toBe(RiskLevel.HIGH);
  });

  it('does not flag fresh ready_for_pickup as stuck', () => {
    const now = DateTime.utc();
    const result = service.calculateRiskScore({
      current_status: 'ready_for_pickup',
      updated_at: now.minus({ hours: 1 }).toISO(),
    });
    expect(result.factors.some((f) => f.includes('Stuck'))).toBe(false);
    expect(service.getRiskLevel(result.score)).toBe(RiskLevel.LOW);
  });

  it('uses preferred_date + time_slot_end for past delivery window', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-20T18:00:00.000Z'));
    const result = service.calculateRiskScore({
      current_status: 'out_for_delivery',
      updated_at: nowIsoHoursAgo(1),
      delivery_time_window: {
        preferred_date: '2026-08-20',
        time_slot_end: '12:00:00',
      },
    });
    jest.useRealTimers();

    expect(result.factors.some((f) => f.includes('Past delivery window'))).toBe(
      true
    );
  });
});

function nowIsoHoursAgo(hours: number): string {
  return DateTime.utc().minus({ hours }).toISO() as string;
}
