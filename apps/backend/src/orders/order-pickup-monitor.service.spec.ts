import { OrderPickupMonitorService } from './order-pickup-monitor.service';
import { DEFAULT_PICKUP_MONITOR_CONFIG } from './order-pickup.types';

describe('OrderPickupMonitorService', () => {
  const makeService = () =>
    new OrderPickupMonitorService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

  describe('computePickupDueAt', () => {
    it('uses assignment SLA when pickup_by is null', () => {
      const service = makeService();
      const assignedAt = new Date('2026-08-02T12:00:00.000Z');
      const due = service.computePickupDueAt(
        { pickup_by: null },
        assignedAt,
        DEFAULT_PICKUP_MONITOR_CONFIG
      );
      expect(due.toISOString()).toBe('2026-08-02T12:20:00.000Z');
    });

    it('uses later pickup_by for scheduled windows', () => {
      const service = makeService();
      const assignedAt = new Date('2026-08-02T12:00:00.000Z');
      const due = service.computePickupDueAt(
        { pickup_by: '2026-08-02T15:00:00.000Z' },
        assignedAt,
        DEFAULT_PICKUP_MONITOR_CONFIG
      );
      expect(due.toISOString()).toBe('2026-08-02T15:00:00.000Z');
    });

    it('uses SLA when pickup_by is earlier than SLA due', () => {
      const service = makeService();
      const assignedAt = new Date('2026-08-02T12:00:00.000Z');
      const due = service.computePickupDueAt(
        { pickup_by: '2026-08-02T12:05:00.000Z' },
        assignedAt,
        DEFAULT_PICKUP_MONITOR_CONFIG
      );
      expect(due.toISOString()).toBe('2026-08-02T12:20:00.000Z');
    });
  });
});
