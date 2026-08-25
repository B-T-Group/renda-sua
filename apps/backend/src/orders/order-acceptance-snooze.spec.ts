import { HttpStatus } from '@nestjs/common';
import { OrderAcceptanceService } from './order-acceptance.service';

describe('OrderAcceptanceService busy snooze', () => {
  const nowIso = '2026-08-25T12:00:00.000Z';

  const orderConfig = {
    acceptanceGraceSeconds: 60,
    busyInterruptSnoozeMinutes: 15,
    busyExtraPrepMinutes: 15,
    busyExtraPrepCapMinutes: 60,
    defaultEstimatedPrepMinutes: 30,
  };

  function createService() {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    const waitAndExecute = {
      scheduleAcceptanceTimeout: jest.fn().mockResolvedValue(undefined),
    };
    const orderSystemJobs = {
      autoDeclineUnacceptedOrderAsSystem: jest.fn(),
    };
    const notifications = {
      sendOrderAcceptanceEscalationPush: jest.fn().mockResolvedValue(undefined),
      sendOrderBusyPush: jest.fn().mockResolvedValue(undefined),
    };
    const fulfillmentPromiseService = {
      persistForOrder: jest.fn().mockResolvedValue(undefined),
    };
    const service = new OrderAcceptanceService(
      hasura as never,
      { get: jest.fn().mockReturnValue(orderConfig) } as never,
      waitAndExecute as never,
      orderSystemJobs as never,
      notifications as never,
      {} as never,
      {} as never,
      fulfillmentPromiseService as never
    );
    return {
      service,
      hasura,
      waitAndExecute,
      orderSystemJobs,
      notifications,
      fulfillmentPromiseService,
    };
  }

  function slaOrder(
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      id: 'order-1',
      order_number: '1001',
      current_status: 'pending',
      acceptance_state: 'awaiting_acceptance',
      acceptance_deadline_at: '2026-08-25T11:59:00.000Z',
      grace_deadline_at: null,
      business_id: 'biz-1',
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(nowIso));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('skips escalation when the order is missing', async () => {
    const { service, hasura, waitAndExecute } = createService();
    hasura.executeQuery.mockResolvedValue({ orders_by_pk: null });

    await expect(service.onAcceptanceDeadline('order-1')).resolves.toEqual({
      success: true,
      skipped: true,
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(waitAndExecute.scheduleAcceptanceTimeout).not.toHaveBeenCalled();
  });

  it('reschedules a premature acceptance deadline after Busy', async () => {
    const { service, hasura, waitAndExecute, notifications } = createService();
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: slaOrder({
        acceptance_deadline_at: '2026-08-25T12:15:00.000Z',
      }),
    });

    await expect(service.onAcceptanceDeadline('order-1')).resolves.toEqual({
      success: true,
      skipped: true,
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(notifications.sendOrderAcceptanceEscalationPush).not.toHaveBeenCalled();
    expect(waitAndExecute.scheduleAcceptanceTimeout).toHaveBeenCalledWith(
      'order.acceptance_deadline',
      { order_id: 'order-1' },
      15 * 60
    );
  });

  it('escalates when the acceptance deadline has passed', async () => {
    const { service, hasura, waitAndExecute, notifications } = createService();
    hasura.executeQuery.mockResolvedValue({ orders_by_pk: slaOrder() });
    hasura.executeMutation.mockResolvedValue({ update_orders_by_pk: { id: 'order-1' } });

    await expect(service.onAcceptanceDeadline('order-1')).resolves.toEqual({
      success: true,
    });
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('EscalateAcceptance'),
      { id: 'order-1', grace: '2026-08-25T12:01:00.000Z' }
    );
    expect(notifications.sendOrderAcceptanceEscalationPush).toHaveBeenCalled();
    expect(waitAndExecute.scheduleAcceptanceTimeout).toHaveBeenCalledWith(
      'order.acceptance_grace_deadline',
      { order_id: 'order-1' },
      60
    );
  });

  it('reschedules a premature grace deadline after Busy', async () => {
    const { service, hasura, waitAndExecute, orderSystemJobs } = createService();
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: slaOrder({
        acceptance_state: 'grace',
        grace_deadline_at: '2026-08-25T12:15:00.000Z',
      }),
    });

    await expect(service.onGraceDeadline('order-1')).resolves.toEqual({
      success: true,
      skipped: true,
    });
    expect(orderSystemJobs.autoDeclineUnacceptedOrderAsSystem).not.toHaveBeenCalled();
    expect(waitAndExecute.scheduleAcceptanceTimeout).toHaveBeenCalledWith(
      'order.acceptance_grace_deadline',
      { order_id: 'order-1' },
      15 * 60
    );
  });

  it('auto-declines when the grace deadline has passed', async () => {
    const { service, hasura, orderSystemJobs, waitAndExecute } = createService();
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: slaOrder({
        acceptance_state: 'grace',
        grace_deadline_at: '2026-08-25T11:59:00.000Z',
      }),
    });
    orderSystemJobs.autoDeclineUnacceptedOrderAsSystem.mockResolvedValue(false);

    await expect(service.onGraceDeadline('order-1')).resolves.toEqual({
      success: true,
      skipped: true,
    });
    expect(orderSystemJobs.autoDeclineUnacceptedOrderAsSystem).toHaveBeenCalledWith(
      'order-1'
    );
    expect(waitAndExecute.scheduleAcceptanceTimeout).not.toHaveBeenCalled();
  });

  it('excludes recently Busy orders from the pending interrupt query', async () => {
    const { service, hasura } = createService();
    hasura.executeQuery.mockResolvedValue({ orders: [] });

    await expect(service.getPendingAcceptanceForBusiness('biz-1')).resolves.toEqual({
      active: false,
      order: null,
    });
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/busy_extra_prep_minutes:\s*\{\s*_gt:\s*0\s*\}/),
      { bid: 'biz-1', snoozeCutoff: '2026-08-25T11:45:00.000Z' }
    );
  });

  it('rejects Busy before the confirmation timer starts', async () => {
    const { service, hasura } = createService();
    hasura.executeQuery.mockImplementation((query: string) => {
      if (query.includes('OrderAcceptDetail')) {
        return Promise.resolve({
          orders_by_pk: slaOrder({ acceptance_state: 'scheduled' }),
        });
      }
      if (query.includes('Own')) {
        return Promise.resolve({ businesses_by_pk: { user_id: 'user-1' } });
      }
      return Promise.resolve({});
    });

    await expect(service.markBusy('order-1', 'user-1')).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects Busy from a user who does not own the shop', async () => {
    const { service, hasura } = createService();
    hasura.executeQuery.mockImplementation((query: string) => {
      if (query.includes('OrderAcceptDetail')) {
        return Promise.resolve({ orders_by_pk: slaOrder() });
      }
      if (query.includes('Own')) {
        return Promise.resolve({ businesses_by_pk: { user_id: 'other' } });
      }
      return Promise.resolve({});
    });

    await expect(service.markBusy('order-1', 'user-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('extends the acceptance SLA and returns snoozeUntil', async () => {
    const {
      service,
      hasura,
      waitAndExecute,
      fulfillmentPromiseService,
    } = createService();
    const updated = slaOrder({
      busy_extra_prep_minutes: 15,
      estimated_prep_minutes: 45,
      acceptance_deadline_at: '2026-08-25T12:15:00.000Z',
    });
    hasura.executeQuery.mockImplementation((query: string) => {
      if (query.includes('OrderAcceptDetail')) {
        return Promise.resolve({
          orders_by_pk: slaOrder({
            busy_extra_prep_minutes: 0,
            acceptance_deadline_at: '2026-08-25T12:02:00.000Z',
          }),
        });
      }
      if (query.includes('Own')) {
        return Promise.resolve({ businesses_by_pk: { user_id: 'user-1' } });
      }
      return Promise.resolve({ orders_by_pk: slaOrder() });
    });
    hasura.executeMutation.mockResolvedValue({ update_orders_by_pk: updated });

    const result = await service.markBusy('order-1', 'user-1');

    expect(result.snoozeUntil).toBe('2026-08-25T12:15:00.000Z');
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('MarkBusy'),
      {
        id: 'order-1',
        extra: 15,
        prep: 45,
        deadline: '2026-08-25T12:15:00.000Z',
        grace: null,
      }
    );
    expect(waitAndExecute.scheduleAcceptanceTimeout).toHaveBeenCalledWith(
      'order.acceptance_deadline',
      { order_id: 'order-1' },
      15 * 60
    );
    expect(fulfillmentPromiseService.persistForOrder).toHaveBeenCalledWith(
      'order-1',
      { extendPrepMinutes: 15 }
    );
  });
});
