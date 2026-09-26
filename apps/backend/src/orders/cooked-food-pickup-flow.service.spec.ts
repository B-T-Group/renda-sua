import { CookedFoodPickupFlowService } from './cooked-food-pickup-flow.service';

describe('CookedFoodPickupFlowService', () => {
  const makeService = (overrides?: {
    order?: Record<string, unknown> | null;
    hours?: number;
  }) => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        orders_by_pk: overrides?.order ?? null,
      }),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const config = {
      get: jest.fn().mockReturnValue({
        cookedFoodUnpaidCancelHours: overrides?.hours ?? 3,
      }),
    };
    const wait = {
      scheduleAcceptanceTimeout: jest.fn().mockResolvedValue(undefined),
    };
    const status = {
      updateOrderStatus: jest.fn().mockResolvedValue({}),
    };
    const service = new CookedFoodPickupFlowService(
      hasura as any,
      config as any,
      wait as any,
      status as any
    );
    return { service, hasura, wait, status };
  };

  it('normalizes preset and custom ready-in minutes', () => {
    const { service } = makeService();
    expect(service.normalizeReadyInMinutes(30)).toBe(30);
    expect(service.normalizeReadyInMinutes(20)).toBe(20);
    expect(service.normalizeReadyInMinutes(undefined)).toBe(30);
    expect(() => service.normalizeReadyInMinutes(2)).toThrow();
  });

  it('schedules auto-mark-ready after preparing', async () => {
    const { service, wait, status } = makeService();
    await service.enterPreparingAndScheduleReady('o1', 15);
    expect(status.updateOrderStatus).toHaveBeenCalledWith('o1', 'preparing', {
      viaSystem: true,
    });
    expect(wait.scheduleAcceptanceTimeout).toHaveBeenCalledWith(
      'order.auto_mark_ready',
      { order_id: 'o1' },
      15 * 60
    );
  });

  it('auto-marks only while preparing and paid', async () => {
    const { service } = makeService({
      order: {
        id: 'o1',
        is_cooked_food_pickup: true,
        fulfillment_method: 'pickup',
        current_status: 'preparing',
        payment_status: 'paid',
      },
    });
    await expect(service.shouldAutoMarkReady('o1')).resolves.toEqual({
      success: true,
      shouldMarkReady: true,
    });
  });

  it('skips auto-mark when unpaid', async () => {
    const { service } = makeService({
      order: {
        id: 'o1',
        is_cooked_food_pickup: true,
        fulfillment_method: 'pickup',
        current_status: 'preparing',
        payment_status: 'pending',
      },
    });
    await expect(service.shouldAutoMarkReady('o1')).resolves.toMatchObject({
      shouldMarkReady: false,
      reason: 'unpaid',
    });
  });

  it('cancels unpaid confirmed pay-after-confirm orders', async () => {
    const { service } = makeService({
      order: {
        id: 'o1',
        pay_after_merchant_confirm: true,
        current_status: 'confirmed',
        payment_status: 'pending',
      },
    });
    await expect(service.shouldCancelUnpaid('o1')).resolves.toEqual({
      success: true,
      shouldCancel: true,
    });
  });

  it('arms full prep seconds from estimated minutes (payment clock)', () => {
    const { service } = makeService();
    expect(
      service.readySecondsFromEstimatedPrep({ estimated_prep_minutes: 15 })
    ).toBe(15 * 60);
    expect(service.readySecondsFromEstimatedPrep({})).toBe(30 * 60);
  });
});
