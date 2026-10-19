import {
  localDateTimeAt,
  resolveSlotForLocalTime,
  slotKeyFromSlotName,
  timeToMinutes,
  toDedicatedSlotBounds,
} from './dedicated-slot.util';

const rows = [
  { id: 's-m', slot_name: 'Morning', slot_type: 'standard', start_time: '08:00:00', end_time: '12:00:00' },
  { id: 's-a', slot_name: 'Afternoon', slot_type: 'standard', start_time: '12:00:00', end_time: '16:00:00' },
  { id: 's-e', slot_name: 'Evening', slot_type: 'standard', start_time: '16:00:00', end_time: '20:00:00' },
  { id: 's-mf', slot_name: 'Morning Fast', slot_type: 'fast', start_time: '09:00:00', end_time: '12:00:00' },
];
const slots = toDedicatedSlotBounds(rows);

describe('slot mapping', () => {
  it('maps only the standard Morning / Afternoon / Evening rows', () => {
    expect(slots.map((s) => [s.slotKey, s.slotId])).toEqual([
      ['morning', 's-m'],
      ['afternoon', 's-a'],
      ['evening', 's-e'],
    ]);
    expect(slotKeyFromSlotName('Morning Fast')).toBeNull();
    const fastNamedMorning = { id: 'f', slot_name: 'Morning', slot_type: 'fast', start_time: '06:00', end_time: '07:00' };
    expect(toDedicatedSlotBounds([fastNamedMorning, ...rows]).find((s) => s.slotKey === 'morning')?.slotId).toBe('s-m');
    expect(slotKeyFromSlotName(' evening ')).toBe('evening');
  });

  it('parses HH:MM and HH:MM:SS', () => {
    expect(timeToMinutes('11:59')).toBe(719);
    expect(timeToMinutes('12:00:00')).toBe(720);
    expect(timeToMinutes('nope')).toBeNull();
  });
});

describe('resolveSlotForLocalTime', () => {
  it.each([
    ['07:59', null],
    ['08:00', 'morning'],
    ['11:59', 'morning'],
    ['12:00', 'afternoon'],
    ['15:59:59', 'afternoon'],
    ['16:00', 'evening'],
    ['20:00', 'evening'],
    ['20:14', 'evening'],
    ['20:15', null],
  ])('%s -> %s (15-min end grace)', (time, key) => {
    expect(resolveSlotForLocalTime(slots, time, 15)?.slotKey ?? null).toBe(key);
  });

  it('no grace -> the end is exclusive', () => {
    expect(resolveSlotForLocalTime(slots, '20:00', 0)).toBeNull();
  });
});

describe('localDateTimeAt (country timezone, D12)', () => {
  it('Africa/Douala (UTC+1): 10:59Z is 11:59 Morning, 11:00Z is 12:00 Afternoon', () => {
    const a = localDateTimeAt(new Date('2026-10-18T10:59:00Z'), 'Africa/Douala');
    const b = localDateTimeAt(new Date('2026-10-18T11:00:00Z'), 'Africa/Douala');
    expect(a).toEqual({ date: '2026-10-18', time: '11:59' });
    expect(b).toEqual({ date: '2026-10-18', time: '12:00' });
    expect(resolveSlotForLocalTime(slots, a.time, 15)?.slotKey).toBe('morning');
    expect(resolveSlotForLocalTime(slots, b.time, 15)?.slotKey).toBe('afternoon');
  });

  it('local date rolls over in the country zone, not UTC', () => {
    expect(localDateTimeAt(new Date('2026-10-17T23:30:00Z'), 'Africa/Douala').date).toBe('2026-10-18');
    expect(localDateTimeAt(new Date('2026-10-18T03:30:00Z'), 'America/Toronto').date).toBe('2026-10-17');
  });
});
