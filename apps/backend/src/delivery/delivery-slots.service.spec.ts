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
  let service: DeliverySlotsService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    service = new DeliverySlotsService(
      hasura as unknown as HasuraSystemService,
      {
        getTimezone: jest.fn().mockResolvedValue('Africa/Douala'),
      } as unknown as DeliveryConfigService
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
});
