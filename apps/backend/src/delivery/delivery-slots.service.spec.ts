import type { DedicatedAgentsConfigService } from '../dedicated-agents/dedicated-agents-config.service';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  DEFAULT_DELIVERY_SLOT_STATE,
  DeliverySlotsService,
  DeliveryTimeSlot,
} from './delivery-slots.service';

describe('DeliverySlotsService', () => {
  const futureDate = '2099-06-15';

  const stateSlot: DeliveryTimeSlot = {
    id: 'state-slot-1',
    country_code: 'CM',
    state: 'Littoral',
    slot_name: 'Morning',
    slot_type: 'standard',
    start_time: '08:00:00',
    end_time: '12:00:00',
    is_active: true,
    max_orders_per_slot: 10,
    display_order: 1,
  };

  const defaultSlot: DeliveryTimeSlot = {
    id: 'default-slot-1',
    country_code: 'CM',
    state: DEFAULT_DELIVERY_SLOT_STATE,
    slot_name: 'Morning',
    slot_type: 'standard',
    start_time: '08:00:00',
    end_time: '12:00:00',
    is_active: true,
    max_orders_per_slot: 10,
    display_order: 1,
  };

  let hasura: { executeQuery: jest.Mock };
  let dedicatedConfig: { isEnabled: jest.Mock };
  let service: DeliverySlotsService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    dedicatedConfig = { isEnabled: jest.fn().mockResolvedValue(false) };
    service = new DeliverySlotsService(
      hasura as unknown as HasuraSystemService,
      {
        getTimezone: jest.fn().mockResolvedValue('Africa/Douala'),
      } as unknown as DeliveryConfigService,
      dedicatedConfig as unknown as DedicatedAgentsConfigService
    );
  });

  function stubSlots(byState: Record<string, DeliveryTimeSlot[]>) {
    hasura.executeQuery.mockImplementation(async (_q: string, vars: any) => {
      if (vars?.slot_ids) {
        return {
          delivery_time_slots: (vars.slot_ids as string[]).map((id) => ({
            id,
            max_orders_per_slot: 10,
          })),
          delivery_time_windows: [],
        };
      }
      return { delivery_time_slots: byState[vars?.state] ?? [] };
    });
  }

  it('uses state slots when present and does not fall back', async () => {
    stubSlots({
      Littoral: [stateSlot],
      [DEFAULT_DELIVERY_SLOT_STATE]: [defaultSlot],
    });

    const slots = await service.getAvailableSlots(
      'CM',
      'Littoral',
      futureDate,
      false,
      'Africa/Douala'
    );

    expect(slots.map((s) => s.id)).toEqual(['state-slot-1']);
    expect(
      hasura.executeQuery.mock.calls.some(
        ([, vars]) => vars?.state === DEFAULT_DELIVERY_SLOT_STATE
      )
    ).toBe(false);
  });

  it('falls back to country __DEFAULT__ slots when state has none', async () => {
    stubSlots({
      Adamawa: [],
      [DEFAULT_DELIVERY_SLOT_STATE]: [defaultSlot],
    });

    const slots = await service.getAvailableSlots(
      'CM',
      'Adamawa',
      futureDate,
      false,
      'Africa/Douala'
    );

    expect(slots).toHaveLength(1);
    expect(slots[0].id).toBe('default-slot-1');
    expect(slots[0].state).toBe(DEFAULT_DELIVERY_SLOT_STATE);
  });

  it('returns empty when both state and default slots are missing', async () => {
    stubSlots({ Adamawa: [], [DEFAULT_DELIVERY_SLOT_STATE]: [] });

    const slots = await service.getAvailableSlots(
      'CM',
      'Adamawa',
      futureDate,
      false,
      'Africa/Douala'
    );

    expect(slots).toEqual([]);
  });

  describe('#594 AC-B5: only enabled pickup slots, behind dedicated_agents_enabled', () => {
    const slot = (id: string, name: string, start: string, end: string, type: 'standard' | 'fast' = 'standard'): DeliveryTimeSlot => ({
      ...stateSlot,
      id,
      slot_name: name,
      slot_type: type,
      start_time: start,
      end_time: end,
    });
    const standard = [
      slot('m', 'Morning', '08:00:00', '12:00:00'),
      slot('a', 'Afternoon', '12:00:00', '16:00:00'),
      slot('e', 'Evening', '16:00:00', '20:00:00'),
    ];
    const fast = [slot('mf', 'Morning Fast', '08:00:00', '12:00:00', 'fast')];

    function stubWithPickup(disabled: string[]) {
      hasura.executeQuery.mockImplementation(async (query: string, vars: any) => {
        if (vars?.slot_ids) {
          return {
            delivery_time_slots: (vars.slot_ids as string[]).map((id) => ({ id, max_orders_per_slot: 10 })),
            delivery_time_windows: [],
          };
        }
        if (query.includes('BusinessLocationHours')) return { business_locations_by_pk: { operating_hours: null } };
        if (query.includes('BusinessLocationDisabledPickupSlots')) {
          expect(vars).toEqual({ id: 'loc-1' });
          return { business_location_pickup_slots: disabled.map((slot_key) => ({ slot_key, is_enabled: false })) };
        }
        return { delivery_time_slots: vars?.slot_type === 'fast' ? fast : standard };
      });
    }
    const pickupQueried = () =>
      hasura.executeQuery.mock.calls.some(([q]) => String(q).includes('BusinessLocationDisabledPickupSlots'));

    it('flag on: a slot the business turned off is not offered to clients', async () => {
      dedicatedConfig.isEnabled.mockResolvedValue(true);
      stubWithPickup(['evening']);
      const slots = await service.getAvailableSlots('CM', 'Littoral', futureDate, false, 'Africa/Douala', 'loc-1');
      expect(slots.map((s) => s.id)).toEqual(['m', 'a']);
      expect(dedicatedConfig.isEnabled).toHaveBeenCalledWith('CM');
    });

    it('flag off: the list is unchanged and pickup slots are not even read', async () => {
      stubWithPickup(['evening']);
      const slots = await service.getAvailableSlots('CM', 'Littoral', futureDate, false, 'Africa/Douala', 'loc-1');
      expect(slots.map((s) => s.id)).toEqual(['m', 'a', 'e']);
      expect(pickupQueried()).toBe(false);
    });

    it('fast slots and calls without a location are never filtered', async () => {
      dedicatedConfig.isEnabled.mockResolvedValue(true);
      stubWithPickup(['morning']);
      const fastSlots = await service.getAvailableSlots('CM', 'Littoral', futureDate, true, 'Africa/Douala', 'loc-1');
      expect(fastSlots.map((s) => s.id)).toEqual(['mf']);
      const noLocation = await service.getAvailableSlots('CM', 'Littoral', futureDate, false, 'Africa/Douala');
      expect(noLocation.map((s) => s.id)).toEqual(['m', 'a', 'e']);
      expect(pickupQueried()).toBe(false);
    });
  });
});
