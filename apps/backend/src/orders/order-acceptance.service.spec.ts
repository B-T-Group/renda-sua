import { OrderAcceptanceService } from './order-acceptance.service';

describe('OrderAcceptanceService helpers', () => {
  const svc = Object.create(OrderAcceptanceService.prototype) as OrderAcceptanceService;

  it('treats missing operating hours as open', () => {
    expect(svc.isWithinOperatingHours(null)).toBe(true);
    expect(svc.isWithinOperatingHours(undefined)).toBe(true);
  });

  it('respects closed day and open window (full day names)', () => {
    const mondayNoon = new Date('2026-08-03T12:00:00'); // Monday
    expect(
      svc.isWithinOperatingHours(
        { monday: { open: '09:00', close: '17:00' } },
        mondayNoon
      )
    ).toBe(true);
    expect(
      svc.isWithinOperatingHours({ monday: { closed: true } }, mondayNoon)
    ).toBe(false);
    expect(
      svc.isWithinOperatingHours(
        { monday: { open: '13:00', close: '17:00' } },
        mondayNoon
      )
    ).toBe(false);
  });

  it('supports legacy 3-letter day keys for backward compatibility', () => {
    const mondayNoon = new Date('2026-08-03T12:00:00'); // Monday
    expect(
      svc.isWithinOperatingHours(
        { mon: { open: '09:00', close: '17:00' } },
        mondayNoon
      )
    ).toBe(true);
    expect(svc.isWithinOperatingHours({ mon: { closed: true } }, mondayNoon)).toBe(
      false
    );
  });

  it('assertConfirmableAcceptance allows pending awaiting states', () => {
    expect(() =>
      svc.assertConfirmableAcceptance({
        current_status: 'pending',
        acceptance_state: 'grace',
      })
    ).not.toThrow();
  });

  it('assertConfirmableAcceptance allows scheduled early confirm', () => {
    expect(() =>
      svc.assertConfirmableAcceptance({
        current_status: 'pending',
        acceptance_state: 'scheduled',
      })
    ).not.toThrow();
  });

  it('assertConfirmableAcceptance rejects accepted', () => {
    expect(() =>
      svc.assertConfirmableAcceptance({
        current_status: 'pending',
        acceptance_state: 'accepted',
      })
    ).toThrow();
  });

  it('isSlotWithinOperatingHours validates date and slot against hours', () => {
    const hours = { tuesday: { open: '09:00', close: '17:00' } };
    expect(
      svc.isSlotWithinOperatingHours(hours, '2026-08-04', '12:00', '13:00')
    ).toBe(true);
    expect(
      svc.isSlotWithinOperatingHours(hours, '2026-08-04', '18:00', '19:00')
    ).toBe(false);
    expect(
      svc.isSlotWithinOperatingHours(
        { tuesday: { closed: true } },
        '2026-08-04',
        '12:00',
        '13:00'
      )
    ).toBe(false);
  });

  it('computes activation before prep and lead time', () => {
    const readiness = new Date('2026-08-04T16:00:00.000Z'); // Tuesday 12:00 America/New_York EDT
    const prepMinutes = 60;
    const leadMinutes = 30;
    const activation = new Date(
      readiness.getTime() - (prepMinutes + leadMinutes) * 60 * 1000
    );
    expect(activation.toISOString()).toBe('2026-08-04T14:30:00.000Z');
  });
});

describe('OrderAcceptanceService.onAcceptanceDeadline', () => {
  function buildService(order: Record<string, unknown> | null) {
    const svc = Object.create(
      OrderAcceptanceService.prototype
    ) as OrderAcceptanceService & Record<string, any>;
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    svc.hasura = {
      executeQuery: jest.fn().mockResolvedValue({ orders_by_pk: order }),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    svc.configService = {
      get: jest.fn().mockReturnValue({ acceptanceGraceSeconds: 300 }),
    };
    svc.notifications = {
      sendOrderAcceptanceEscalation: jest.fn().mockResolvedValue(undefined),
    };
    svc.waitAndExecute = {
      scheduleAcceptanceTimeout: jest.fn().mockResolvedValue(undefined),
    };
    svc.riskMonitor = {
      evaluateOrderById: jest.fn().mockResolvedValue(undefined),
    };
    return svc;
  }

  const expiredOrder = {
    id: 'order-1',
    order_number: 'RS-1',
    current_status: 'pending',
    acceptance_state: 'awaiting_acceptance',
    acceptance_deadline_at: '2020-01-01T00:00:00.000Z',
    business_id: 'business-1',
  };

  it('opens the risk incident as soon as the order enters grace', async () => {
    const svc = buildService(expiredOrder);

    await svc.onAcceptanceDeadline('order-1');

    expect(svc.riskMonitor.evaluateOrderById).toHaveBeenCalledWith('order-1');
    expect(
      svc.notifications.sendOrderAcceptanceEscalation
    ).toHaveBeenCalled();
  });

  it('does not open a risk incident while the deadline is still in the future', async () => {
    const svc = buildService({
      ...expiredOrder,
      acceptance_deadline_at: new Date(Date.now() + 600_000).toISOString(),
    });

    const result = await svc.onAcceptanceDeadline('order-1');

    expect(result.skipped).toBe(true);
    expect(svc.riskMonitor.evaluateOrderById).not.toHaveBeenCalled();
  });
});
