import { DEDICATED_SLOT_KEYS, type DedicatedSlotKey } from './dedicated-agents.constants';

/** #594 addendum (AC-P1): an agent's preferred delivery slots. All ON by default. */
export interface AgentSlotPrefs {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
}

/** DB column per slot on `public.agents` (whitelist: never build a column name from input). */
export const AGENT_SLOT_PREF_COLUMNS: Record<DedicatedSlotKey, 'pref_morning' | 'pref_afternoon' | 'pref_evening'> = {
  morning: 'pref_morning',
  afternoon: 'pref_afternoon',
  evening: 'pref_evening',
};

export const DEFAULT_AGENT_SLOT_PREFS: Readonly<AgentSlotPrefs> = Object.freeze({
  morning: true,
  afternoon: true,
  evening: true,
});

export interface AgentSlotPrefRow {
  pref_morning?: boolean | null;
  pref_afternoon?: boolean | null;
  pref_evening?: boolean | null;
}

/** Row -> prefs. A missing / null column reads as ON (P1 default), never as OFF. */
export function slotPrefsFromRow(row: AgentSlotPrefRow | null | undefined): AgentSlotPrefs {
  return {
    morning: row?.pref_morning !== false,
    afternoon: row?.pref_afternoon !== false,
    evening: row?.pref_evening !== false,
  };
}

export function isDedicatedSlotKey(raw: unknown): raw is DedicatedSlotKey {
  return typeof raw === 'string' && (DEDICATED_SLOT_KEYS as readonly string[]).includes(raw);
}

/**
 * Dispatch eligibility (AC-P8 / P9): does the agent prefer this scheduled slot?
 * Pure; used by later phases (scheduled dispatch filter, dedicated fallback, posting push).
 * ASAP orders must not call this (AC-P11). An unknown slot key fails closed.
 */
export function agentPrefersSlot(prefs: AgentSlotPrefs | null | undefined, slotKey: string | null | undefined): boolean {
  if (!isDedicatedSlotKey(slotKey)) return false;
  return (prefs ?? DEFAULT_AGENT_SLOT_PREFS)[slotKey] === true;
}

/** AC-P13 / P6: a multi-slot posting applies only when **all** its slots are preferred. */
export function agentPrefersAllSlots(
  prefs: AgentSlotPrefs | null | undefined,
  slotKeys: readonly string[]
): boolean {
  return slotKeys.length > 0 && slotKeys.every((k) => agentPrefersSlot(prefs, k));
}

/** AC-P6: all slots off = scheduled-blind (ASAP only, unless the AC-P10 fallback pulls the agent in). */
export function isScheduledBlind(prefs: AgentSlotPrefs | null | undefined): boolean {
  return DEDICATED_SLOT_KEYS.every((k) => !agentPrefersSlot(prefs, k));
}
