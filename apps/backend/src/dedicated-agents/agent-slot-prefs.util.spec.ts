import {
  agentPrefersAllSlots,
  agentPrefersSlot,
  DEFAULT_AGENT_SLOT_PREFS,
  isScheduledBlind,
  slotPrefsFromRow,
} from './agent-slot-prefs.util';

describe('agent slot prefs util (#594 addendum)', () => {
  it('defaults every slot ON, and a missing / null column reads ON (P1 backfill semantics)', () => {
    expect(DEFAULT_AGENT_SLOT_PREFS).toEqual({ morning: true, afternoon: true, evening: true });
    expect(slotPrefsFromRow(null)).toEqual(DEFAULT_AGENT_SLOT_PREFS);
    expect(slotPrefsFromRow({ pref_morning: null })).toEqual(DEFAULT_AGENT_SLOT_PREFS);
    expect(slotPrefsFromRow({ pref_morning: false, pref_afternoon: true, pref_evening: true })).toEqual({
      morning: false,
      afternoon: true,
      evening: true,
    });
  });

  it('agentPrefersSlot follows the pref and fails closed on an unknown slot', () => {
    const prefs = { morning: true, afternoon: false, evening: true };
    expect(agentPrefersSlot(prefs, 'morning')).toBe(true);
    expect(agentPrefersSlot(prefs, 'afternoon')).toBe(false);
    expect(agentPrefersSlot(prefs, 'night')).toBe(false);
    expect(agentPrefersSlot(prefs, null)).toBe(false);
    expect(agentPrefersSlot(undefined, 'evening')).toBe(true);
  });

  it('a multi-slot posting needs all its slots preferred', () => {
    const prefs = { morning: true, afternoon: false, evening: true };
    expect(agentPrefersAllSlots(prefs, ['morning', 'evening'])).toBe(true);
    expect(agentPrefersAllSlots(prefs, ['morning', 'afternoon'])).toBe(false);
    expect(agentPrefersAllSlots(prefs, [])).toBe(false);
  });

  it('all off = scheduled-blind', () => {
    expect(isScheduledBlind({ morning: false, afternoon: false, evening: false })).toBe(true);
    expect(isScheduledBlind({ morning: false, afternoon: false, evening: true })).toBe(false);
  });
});
