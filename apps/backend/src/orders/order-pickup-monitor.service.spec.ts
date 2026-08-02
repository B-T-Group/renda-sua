import { OrderPickupMonitorService } from './order-pickup-monitor.service';
import { DEFAULT_PICKUP_MONITOR_CONFIG } from './order-pickup.types';

describe('OrderPickupMonitorService', () => {
  const makeService = (hasura?: { executeQuery: jest.Mock }) =>
    new OrderPickupMonitorService(
      (hasura ?? { executeQuery: jest.fn() }) as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

  describe('queryActive due filter', () => {
    it('passes timestamptz comparison without nesting pickup_due_at', async () => {
      const executeQuery = jest.fn().mockResolvedValue({ orders: [] });
      const service = makeService({ executeQuery });
      await (service as any).reconcileReminders({
        reminderMinutesBefore: 5,
      });
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('PickupActive'),
        expect.objectContaining({
          states: ['monitoring'],
          due: { _lte: expect.any(String) },
        })
      );
      expect(executeQuery.mock.calls[0][1].due).not.toHaveProperty(
        'pickup_due_at'
      );
    });
  });

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
