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

  it('auto-marks delivery pay-after when preparing and paid', async () => {
    const { service } = makeService({
      order: {
        id: 'o1',
        is_cooked_food_pickup: false,
        fulfillment_method: 'delivery',
        pay_after_merchant_confirm: true,
        current_status: 'preparing',
        payment_status: 'paid',
      },
    });
    await expect(service.shouldAutoMarkReady('o1')).resolves.toEqual({
      success: true,
      shouldMarkReady: true,
    });
  });

  it('ready-in cohort includes delivery pay-after and pickup flag', () => {
    const { service } = makeService();
    expect(
      service.isCookedFoodAsapReadyInCohort({
        is_cooked_food_pickup: true,
        fulfillment_method: 'pickup',
      })
    ).toBe(true);
    expect(
      service.isCookedFoodAsapReadyInCohort({
        fulfillment_method: 'delivery',
        pay_after_merchant_confirm: true,
      })
    ).toBe(true);
    expect(
      service.isCookedFoodAsapReadyInCohort({
        fulfillment_method: 'delivery',
        pay_after_merchant_confirm: false,
      })
    ).toBe(false);
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
    expect(
      service.readySecondsFromEstimatedPrep({ estimated_prep_minutes: 0 })
    ).toBe(1);
  });

  it('rejects ready-in minutes outside presets and the custom range', () => {
    const { service } = makeService();
    expect(service.normalizeReadyInMinutes(null)).toBe(30);
    expect(service.normalizeReadyInMinutes(Number.NaN)).toBe(30);
    expect(service.normalizeReadyInMinutes(44.6)).toBe(45);
    expect(service.normalizeReadyInMinutes(4.6)).toBe(5);
    expect(service.normalizeReadyInMinutes(180)).toBe(180);
    expect(() => service.normalizeReadyInMinutes(4)).toThrow(/ready_in_minutes/);
    expect(() => service.normalizeReadyInMinutes(181)).toThrow(/ready_in_minutes/);
  });

  it('auto-marks authorized prep and skips missing, non-pickup, and non-preparing orders', async () => {
    const missing = makeService();
    await expect(missing.service.shouldAutoMarkReady('o1')).resolves.toEqual({
      success: false,
      shouldMarkReady: false,
      reason: 'order_not_found',
    });

    const delivery = makeService({
      order: {
        id: 'o1',
        is_cooked_food_pickup: true,
        fulfillment_method: 'delivery',
        current_status: 'preparing',
        payment_status: 'paid',
      },
    });
    await expect(delivery.service.shouldAutoMarkReady('o1')).resolves.toMatchObject({
      shouldMarkReady: false,
      reason: 'not_cohort',
    });

    const confirmed = makeService({
      order: {
        id: 'o1',
        is_cooked_food_pickup: true,
        fulfillment_method: 'pickup',
        current_status: 'confirmed',
        payment_status: 'paid',
      },
    });
    await expect(confirmed.service.shouldAutoMarkReady('o1')).resolves.toMatchObject({
      shouldMarkReady: false,
      reason: 'not_preparing',
    });

    const authorized = makeService({
      order: {
        id: 'o1',
        is_cooked_food_pickup: true,
        fulfillment_method: 'pickup',
        current_status: 'preparing',
        payment_status: 'authorized',
      },
    });
    await expect(authorized.service.shouldAutoMarkReady('o1')).resolves.toEqual({
      success: true,
      shouldMarkReady: true,
    });
  });

  it('cancels only confirmed unpaid pay-after orders', async () => {
    const missing = makeService();
    await expect(missing.service.shouldCancelUnpaid('o1')).resolves.toEqual({
      success: false,
      shouldCancel: false,
      reason: 'order_not_found',
    });

    const notPayAfter = makeService({
      order: {
        id: 'o1',
        pay_after_merchant_confirm: false,
        current_status: 'confirmed',
        payment_status: 'pending',
      },
    });
    await expect(notPayAfter.service.shouldCancelUnpaid('o1')).resolves.toMatchObject({
      shouldCancel: false,
      reason: 'not_pay_after_confirm',
    });

    const paid = makeService({
      order: {
        id: 'o1',
        pay_after_merchant_confirm: true,
        current_status: 'confirmed',
        payment_status: 'paid',
      },
    });
    await expect(paid.service.shouldCancelUnpaid('o1')).resolves.toMatchObject({
      shouldCancel: false,
      reason: 'already_paid',
    });

    const authorized = makeService({
      order: {
        id: 'o1',
        pay_after_merchant_confirm: true,
        current_status: 'confirmed',
        payment_status: 'authorized',
      },
    });
    await expect(authorized.service.shouldCancelUnpaid('o1')).resolves.toMatchObject({
      shouldCancel: false,
      reason: 'already_paid',
    });

    const preparing = makeService({
      order: {
        id: 'o1',
        pay_after_merchant_confirm: true,
        current_status: 'preparing',
        payment_status: 'pending',
      },
    });
    await expect(preparing.service.shouldCancelUnpaid('o1')).resolves.toMatchObject({
      shouldCancel: false,
      reason: 'not_awaiting_payment',
    });
  });

  it('uses the promised ready time when it is still in the future', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-26T10:00:00.000Z'));
    try {
      const { service } = makeService();
      expect(
        service.remainingReadySeconds({
          promised_ready_at: '2026-09-26T10:01:30.000Z',
          estimated_prep_minutes: 15,
        })
      ).toBe(90);
      expect(
        service.remainingReadySeconds({
          promised_ready_at: '2026-09-26T09:00:00.000Z',
        })
      ).toBe(0);
      expect(
        service.remainingReadySeconds({ estimated_prep_minutes: 15 })
      ).toBe(15 * 60);
    } finally {
      jest.useRealTimers();
    }
  });

  it('skips the mark-ready prompt for cooked-food pickup orders', () => {
    const { service } = makeService();
    expect(service.shouldSkipMarkReadyPrompt({ is_cooked_food_pickup: true })).toBe(
      true
    );
    expect(service.shouldSkipMarkReadyPrompt({ is_cooked_food_pickup: false })).toBe(
      false
    );
  });

  it('clamps unpaid-cancel and auto-ready delays and swallows scheduler errors', async () => {
    const zeroHours = makeService({ hours: 0 });
    await zeroHours.service.scheduleUnpaidCancelAfterConfirm('o1');
    expect(zeroHours.wait.scheduleAcceptanceTimeout).toHaveBeenCalledWith(
      'order.cooked_food_unpaid_cancel',
      { order_id: 'o1' },
      60
    );

    const defaultHours = makeService();
    const config = (defaultHours.service as any).configService as {
      get: jest.Mock;
    };
    config.get.mockReturnValue(undefined);
    await defaultHours.service.scheduleUnpaidCancelAfterConfirm('o2');
    expect(defaultHours.wait.scheduleAcceptanceTimeout).toHaveBeenCalledWith(
      'order.cooked_food_unpaid_cancel',
      { order_id: 'o2' },
      3 * 3600
    );

    defaultHours.wait.scheduleAcceptanceTimeout.mockRejectedValue(
      new Error('queue down')
    );
    await expect(
      defaultHours.service.scheduleAutoMarkReady('o2', 0)
    ).resolves.toBeUndefined();
    expect(defaultHours.wait.scheduleAcceptanceTimeout).toHaveBeenCalledWith(
      'order.auto_mark_ready',
      { order_id: 'o2' },
      1
    );
  });
});
