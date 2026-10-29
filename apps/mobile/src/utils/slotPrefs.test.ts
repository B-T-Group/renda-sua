import { describe, expect, it } from 'vitest';
import {
  canResume,
  formatStoreNames,
  isAllOff,
  missingPreferredSlots,
  parseSlotOffConflict,
  postingMatchesPrefs,
} from './slotPrefs';

const prefs = { morning: true, afternoon: false, evening: true };

describe('slotPrefs', () => {
  it('detects all off', () => {
    expect(isAllOff({ morning: false, afternoon: false, evening: false })).toBe(true);
    expect(isAllOff(prefs)).toBe(false);
  });

  it('needs every posting slot preferred (AC-P14)', () => {
    expect(postingMatchesPrefs([{ slotKey: 'morning' }], prefs)).toBe(true);
    expect(postingMatchesPrefs([{ slotKey: 'morning' }, { slotKey: 'afternoon' }], prefs)).toBe(false);
    expect(missingPreferredSlots([{ slotKey: 'afternoon' }, { slotKey: 'afternoon' }], prefs)).toEqual(['afternoon']);
    expect(missingPreferredSlots([{ slotKey: 'afternoon' }], null)).toEqual([]);
  });

  it('gates resume on slot pref and slot-off pause reason (AC-P5)', () => {
    const a = { status: 'paused', pauseReason: 'paused_slot_off', slotKey: 'afternoon' as const };
    expect(canResume(a, prefs)).toBe(false);
    expect(canResume(a, { ...prefs, afternoon: true })).toBe(true);
    expect(canResume({ ...a, pauseReason: 'store' }, { ...prefs, afternoon: true })).toBe(false);
  });

  it('parses the 409 conflict body', () => {
    const err = Object.assign(new Error('x'), {
      status: 409,
      code: 'slot_has_dedicated_assignments',
      data: { code: 'slot_has_dedicated_assignments', slots: ['morning'], stores: [{ assignmentId: 'a', locationId: 'l', storeName: 'S', slotKey: 'morning' }] },
    });
    expect(parseSlotOffConflict(err)?.stores).toHaveLength(1);
    expect(parseSlotOffConflict({ status: 409, code: 'other' })).toBeNull();
    expect(parseSlotOffConflict({ status: 500 })).toBeNull();
  });

  it('falls back for empty store names and de-dupes', () => {
    expect(formatStoreNames([{ storeName: '' }, { storeName: 'Bio' }, { storeName: 'Bio' }], 'a store')).toBe('a store, Bio');
  });
});
