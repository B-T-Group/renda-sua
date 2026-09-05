import { FulfillmentPromiseService } from './fulfillment-promise.service';

describe('FulfillmentPromiseService', () => {
  const service = new FulfillmentPromiseService(
    { executeQuery: jest.fn(), executeMutation: jest.fn() } as any,
    {
      get: () => ({
        defaultEstimatedPrepMinutes: 30,
        asapTravelBufferMinutes: 30,
        asapPickupGraceMinutes: 60,
        asapCloseBufferMinutes: 15,
        asapFastTravelBufferMinutes: 20,
      }),
    } as any,
    { getTimezone: jest.fn().mockResolvedValue('Africa/Libreville') } as any
  );

  const weekdayHours = {
    monday: { closed: false, open: '08:00', close: '20:00' },
    tuesday: { closed: false, open: '08:00', close: '20:00' },
    wednesday: { closed: false, open: '08:00', close: '20:00' },
    thursday: { closed: false, open: '08:00', close: '20:00' },
    friday: { closed: false, open: '08:00', close: '20:00' },
    saturday: { closed: true },
    sunday: { closed: true },
  };

  it('adds prep plus travel buffer for ASAP delivery', () => {
    const now = new Date('2026-08-20T10:00:00.000Z');
    const promise = service.computeAsapPromise('delivery', 30, false, now);
    expect(promise.promisedReadyAt.toISOString()).toBe(
      '2026-08-20T10:30:00.000Z'
    );
    expect(promise.promisedFulfillBy.toISOString()).toBe(
      '2026-08-20T11:00:00.000Z'
    );
  });

  it('uses pickup grace for ASAP pickup', () => {
    const now = new Date('2026-08-20T10:00:00.000Z');
    const promise = service.computeAsapPromise('pickup', 25, false, now);
    expect(promise.promisedFulfillBy.toISOString()).toBe(
      '2026-08-20T11:25:00.000Z'
    );
  });

  it('infers scheduled when a window is present', () => {
    expect(service.inferTiming(true, 'delivery')).toBe('scheduled');
    expect(service.inferTiming(false, 'pickup')).toBe('asap');
    expect(service.inferTiming(false, 'shipping')).toBeNull();
  });

  it('requires a slot when the store is closed', () => {
    const sunday = new Date('2026-08-23T12:00:00.000Z');
    const result = service.evaluateAsap({
      operatingHours: weekdayHours,
      prepMinutes: 30,
      fulfillmentMethod: 'delivery',
      timezone: 'UTC',
      now: sunday,
    });
    expect(result.available).toBe(false);
    expect(result.scheduleRequired).toBe(true);
    expect(result.reason).toBe('merchant_closed');
  });

  it('requires a slot when remaining time is less than prep plus buffers', () => {
    const nearClose = new Date('2026-08-21T19:20:00.000Z');
    const result = service.evaluateAsap({
      operatingHours: weekdayHours,
      prepMinutes: 30,
      fulfillmentMethod: 'delivery',
      timezone: 'UTC',
      now: nearClose,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('too_close_to_close');
  });

  it('rejects pickup ASAP when grace would land after close', () => {
    const nearClose = new Date('2026-08-21T18:50:00.000Z');
    const result = service.evaluateAsap({
      operatingHours: weekdayHours,
      prepMinutes: 30,
      fulfillmentMethod: 'pickup',
      timezone: 'UTC',
      now: nearClose,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('too_close_to_close');
  });

  it('keeps an existing ASAP promise instead of recomputing from now', () => {
    const existing = {
      promisedReadyAt: '2026-08-21T12:30:00.000Z',
      promisedFulfillBy: '2026-08-21T13:00:00.000Z',
      fulfillmentMethod: 'delivery',
    } as any;
    const kept = (service as any).resolveAsapPromise(existing, 30);
    expect(kept.promisedReadyAt.toISOString()).toBe(
      '2026-08-21T12:30:00.000Z'
    );
    expect(kept.promisedFulfillBy.toISOString()).toBe(
      '2026-08-21T13:00:00.000Z'
    );
  });

  it('reanchors an ASAP promise from ready time without adding prep', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        orders_by_pk: {
          id: 'order-1',
          business_id: 'biz-1',
          fulfillment_method: 'pickup',
          fulfillment_timing: 'asap',
          requires_fast_delivery: false,
        },
      }),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const anchored = new FulfillmentPromiseService(
      hasura as any,
      {
        get: () => ({
          defaultEstimatedPrepMinutes: 30,
          asapTravelBufferMinutes: 30,
          asapPickupGraceMinutes: 60,
          asapCloseBufferMinutes: 15,
          asapFastTravelBufferMinutes: 20,
        }),
      } as any,
      { getTimezone: jest.fn().mockResolvedValue('Africa/Libreville') } as any
    );
    const readyAt = new Date('2026-08-02T20:00:00.000Z');
    await anchored.reanchorAsapAtReady('order-1', readyAt);
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SetFulfillmentPromise'),
      expect.objectContaining({
        id: 'order-1',
        timing: 'asap',
        ready: '2026-08-02T20:00:00.000Z',
        by: '2026-08-02T21:00:00.000Z',
      })
    );
  });

  it('does not reanchor a scheduled order', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        orders_by_pk: {
          id: 'order-2',
          business_id: 'biz-1',
          fulfillment_method: 'delivery',
          fulfillment_timing: 'scheduled',
          delivery_time_windows: [
            { preferred_date: '2026-08-03', time_slot_start: '10:00' },
          ],
        },
      }),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const anchored = new FulfillmentPromiseService(
      hasura as any,
      {
        get: () => ({
          defaultEstimatedPrepMinutes: 30,
          asapTravelBufferMinutes: 30,
          asapPickupGraceMinutes: 60,
          asapCloseBufferMinutes: 15,
          asapFastTravelBufferMinutes: 20,
        }),
      } as any,
      { getTimezone: jest.fn().mockResolvedValue('Africa/Libreville') } as any
    );
    await anchored.reanchorAsapAtReady('order-2');
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('extends an existing ASAP promise when prep grows', () => {
    const existing = {
      promisedReadyAt: '2026-08-21T12:30:00.000Z',
      promisedFulfillBy: '2026-08-21T13:00:00.000Z',
      fulfillmentMethod: 'delivery',
    } as any;
    const extended = (service as any).resolveAsapPromise(existing, 50, 20);
    expect(extended.promisedReadyAt.toISOString()).toBe(
      '2026-08-21T12:50:00.000Z'
    );
    expect(extended.promisedFulfillBy.toISOString()).toBe(
      '2026-08-21T13:20:00.000Z'
    );
  });

  it('allows ASAP when the store is open with enough time', () => {
    const midday = new Date('2026-08-21T12:00:00.000Z');
    const result = service.evaluateAsap({
      operatingHours: weekdayHours,
      prepMinutes: 30,
      fulfillmentMethod: 'delivery',
      timezone: 'UTC',
      now: midday,
    });
    expect(result.available).toBe(true);
    expect(result.scheduleRequired).toBe(false);
  });
});
