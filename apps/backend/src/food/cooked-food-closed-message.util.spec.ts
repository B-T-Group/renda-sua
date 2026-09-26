import {
  buildCookedFoodStoreClosedMessage,
  collectCookedFoodSlots,
} from './cooked-food-closed-message.util';
import { formatFoodSlotsForDisplay } from './food-availability.util';
import { formatOperatingHoursForDisplay } from '../common/operating-hours.util';

describe('formatFoodSlotsForDisplay', () => {
  it('formats weekday serving windows', () => {
    expect(
      formatFoodSlotsForDisplay([
        { day_of_week: 1, start_time: '11:30:00', end_time: '16:00:00' },
        { day_of_week: 5, start_time: '18:00', end_time: '22:00' },
      ])
    ).toBe('Mon 11:30–16:00, Fri 18:00–22:00');
  });
});

describe('formatOperatingHoursForDisplay', () => {
  it('lists open days only', () => {
    expect(
      formatOperatingHoursForDisplay({
        monday: { open: '08:00', close: '20:00' },
        tuesday: { closed: true },
        wednesday: { open: '09:00', close: '17:00' },
      })
    ).toBe('Mon 08:00–20:00, Wed 09:00–17:00');
  });
});

describe('collectCookedFoodSlots', () => {
  it('dedupes slots from cooked-food rows only', () => {
    const slots = collectCookedFoodSlots([
      {
        item: { is_cooked_food: true },
        food_settings: [
          {
            availability_slots: [
              { day_of_week: 1, start_time: '11:30', end_time: '16:00' },
            ],
          },
        ],
      },
      {
        item: { is_cooked_food: true },
        food_settings: [
          {
            availability_slots: [
              { day_of_week: 1, start_time: '11:30', end_time: '16:00' },
              { day_of_week: 2, start_time: '11:30', end_time: '16:00' },
            ],
          },
        ],
      },
      {
        item: { is_cooked_food: false },
        food_settings: [
          {
            availability_slots: [
              { day_of_week: 3, start_time: '09:00', end_time: '12:00' },
            ],
          },
        ],
      },
    ]);
    expect(slots).toEqual([
      { day_of_week: 1, start_time: '11:30', end_time: '16:00' },
      { day_of_week: 2, start_time: '11:30', end_time: '16:00' },
    ]);
  });
});

describe('buildCookedFoodStoreClosedMessage', () => {
  it('includes food hours and next opening', () => {
    const message = buildCookedFoodStoreClosedMessage({
      timezone: 'Africa/Douala',
      opensAt: '2026-08-25T10:30:00.000Z',
      foodSlots: [
        { day_of_week: 1, start_time: '11:30', end_time: '16:00' },
      ],
    });
    expect(message).toContain('This kitchen is closed right now.');
    expect(message).toContain('Available: Mon 11:30–16:00.');
    expect(message).toContain('Next opening:');
    expect(message).not.toContain('Cooked food is ASAP only');
  });

  it('falls back to store hours when food slots are missing', () => {
    const message = buildCookedFoodStoreClosedMessage({
      timezone: 'Africa/Douala',
      operatingHours: {
        friday: { open: '10:00', close: '22:00' },
      },
    });
    expect(message).toBe(
      'This kitchen is closed right now. Available: Fri 10:00–22:00.'
    );
  });
});
