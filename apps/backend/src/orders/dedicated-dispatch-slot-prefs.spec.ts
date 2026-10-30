import { DedicatedDispatchService } from './dedicated-dispatch.service';

/**
 * #594 addendum: scheduledSlotKey decides whether normal dispatch filters by
 * preferred slots, and accept keeps a live offer after the agent turns the
 * slot off (AC-P12). The offer-pool filter itself is in order-offers-slot-prefs.
 */
describe('DedicatedDispatchService slot preference wiring', () => {
  const window = {
    slot_id: 'cm-a' as string | null,
    preferred_date: '2026-10-18' as string | null,
    is_confirmed: true,
    time_slot_start: '12:00:00' as string | null,
  };

  const order = (over: Record<string, unknown> = {}) => ({
    id: 'order-1',
    business_id: 'biz-1',
    business_location_id: 'loc-1',
    fulfillment_timing: 'scheduled',
    subtotal: 1000,
    currency: 'XAF',
    verified_agent_delivery: false,
    coverage_slot_key: 'afternoon' as string | null,
    business_location: { address: { country: 'CM' } },
    delivery_time_windows: [{ ...window }],
    ...over,
  });

  const harness = (row: Record<string, unknown> | null) => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        orders_by_pk: row,
        order_offers: [{ agent_id: 'a1', user_id: 'u1', status: 'offered' }],
      }),
    };
    const coverage = {
      resolveSlot: jest.fn().mockResolvedValue({ slotKey: 'evening', date: '2026-10-18' }),
      evaluate: jest.fn(async (params: { ignoreSlotPrefs?: boolean }) =>
        params.ignoreSlotPrefs
          ? { eligible: [{ agentId: 'a1', assignmentId: 'as-1' }], rejected: [] }
          : { eligible: [], rejected: [{ agentId: 'a1', assignmentId: 'as-1', reason: 'slot_pref_off' }] }
      ),
    };
    const config = {
      isEnabled: jest.fn().mockResolvedValue(true),
      getConfig: jest.fn().mockResolvedValue({ maxActiveOrders: 10 }),
    };
    const routing = { resolveRailForBusiness: jest.fn().mockResolvedValue('momo') };
    const blank = {} as never;
    const service = new DedicatedDispatchService(
      hasura as never,
      config as never,
      coverage as never,
      routing as never,
      blank,
      blank,
      blank
    );
    return { service, hasura, coverage };
  };

  describe('scheduledSlotKey', () => {
    it('uses the stored coverage key and does not re-resolve the window', async () => {
      const { service, coverage } = harness(order());
      await expect(service.scheduledSlotKey('order-1')).resolves.toBe('afternoon');
      expect(coverage.resolveSlot).not.toHaveBeenCalled();
    });

    it('ASAP and a missing order do not filter', async () => {
      const asap = harness(order({ fulfillment_timing: 'asap', coverage_slot_key: 'evening' }));
      await expect(asap.service.scheduledSlotKey('order-1')).resolves.toBeNull();
      expect(asap.coverage.resolveSlot).not.toHaveBeenCalled();
      const missing = harness(null);
      await expect(missing.service.scheduledSlotKey('order-1')).resolves.toBeNull();
    });

    it('without a coverage key, the picked slot id wins over the window start', async () => {
      const { service, coverage } = harness(order({ coverage_slot_key: null }));
      await expect(service.scheduledSlotKey('order-1')).resolves.toBe('evening');
      expect(coverage.resolveSlot).toHaveBeenCalledWith({
        locationId: 'loc-1',
        preferredDate: '2026-10-18',
        slotId: 'cm-a',
      });
    });

    it('falls back to the first five characters of time_slot_start when no slot was picked', async () => {
      const row = order({
        coverage_slot_key: '',
        delivery_time_windows: [{ ...window, slot_id: null, time_slot_start: '16:45:00' }],
      });
      const { service, coverage } = harness(row);
      await expect(service.scheduledSlotKey('order-1')).resolves.toBe('evening');
      expect(coverage.resolveSlot).toHaveBeenCalledWith({
        locationId: 'loc-1',
        preferredDate: '2026-10-18',
        windowStart: '16:45',
      });
    });

    it('a null slot resolution does not try the window start afterwards', async () => {
      const { service, coverage } = harness(order({ coverage_slot_key: null }));
      coverage.resolveSlot.mockResolvedValue(null);
      await expect(service.scheduledSlotKey('order-1')).resolves.toBeNull();
      expect(coverage.resolveSlot).toHaveBeenCalledTimes(1);
    });

    it('an unconfirmed window with no date, and a failed load, leave the pool unfiltered', async () => {
      const undated = harness(
        order({ coverage_slot_key: null, delivery_time_windows: [{ ...window, preferred_date: null }] })
      );
      await expect(undated.service.scheduledSlotKey('order-1')).resolves.toBeNull();
      expect(undated.coverage.resolveSlot).not.toHaveBeenCalled();

      const { service, hasura, coverage } = harness(order({ coverage_slot_key: null }));
      hasura.executeQuery.mockRejectedValue(new Error('hasura down'));
      await expect(service.scheduledSlotKey('order-1')).resolves.toBeNull();
      coverage.resolveSlot.mockRejectedValue(new Error('slots down'));
      hasura.executeQuery.mockResolvedValue({ orders_by_pk: order({ coverage_slot_key: null }), order_offers: [] });
      await expect(service.scheduledSlotKey('order-1')).resolves.toBeNull();
    });
  });

  it('AC-P12: accepting a live dedicated offer still succeeds after the slot pref is off', async () => {
    const { service } = harness(order());
    await expect(service.acceptAssignment('order-1', 'a1')).resolves.toEqual({
      source: 'dedicated_offer',
      dedicatedAssignmentId: 'as-1',
      maxActiveOrders: 10,
      countOffers: false,
    });
  });
});
