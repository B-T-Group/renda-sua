/**
 * #594 addendum: pure helpers for agent preferred delivery slots.
 * Kept free of React / native imports so Vitest can cover them.
 */
import type { SlotKey, SlotOffConflict, SlotPreferences } from '../types/dedicatedAgents';

export const SLOT_KEYS: SlotKey[] = ['morning', 'afternoon', 'evening'];

/** Icon-first toggles (§1.7): ☀ morning, ◐ afternoon, ☾ evening. */
export const SLOT_PREF_ICONS: Record<SlotKey, string> = {
  morning: 'white-balance-sunny',
  afternoon: 'circle-half-full',
  evening: 'moon-waning-crescent',
};

export const DEFAULT_SLOT_PREFS: SlotPreferences = { morning: true, afternoon: true, evening: true };

export function isAllOff(prefs: SlotPreferences): boolean {
  return SLOT_KEYS.every((k) => !prefs[k]);
}

/** Slots of a posting the agent has not turned on (unique, in slot order). */
export function missingPreferredSlots(
  postingSlots: Array<{ slotKey: SlotKey }> | SlotKey[],
  prefs: SlotPreferences | null | undefined
): SlotKey[] {
  if (!prefs) return [];
  const keys = new Set(
    (postingSlots as Array<SlotKey | { slotKey: SlotKey }>).map((s) => (typeof s === 'string' ? s : s.slotKey))
  );
  return SLOT_KEYS.filter((k) => keys.has(k) && !prefs[k]);
}

/** AC-P14: Apply needs every one of the posting's slots preferred. */
export function postingMatchesPrefs(
  postingSlots: Array<{ slotKey: SlotKey }>,
  prefs: SlotPreferences | null | undefined
): boolean {
  return missingPreferredSlots(postingSlots, prefs).length === 0;
}

export function isSlotOffPause(a: { status: string; pauseReason?: string | null }): boolean {
  return a.status === 'paused' && a.pauseReason === 'paused_slot_off';
}

/** AC-P5: Resume only while the assignment's slot is ON. */
export function canResume(
  a: { status: string; pauseReason?: string | null; slotKey: SlotKey },
  prefs: SlotPreferences | null | undefined
): boolean {
  return isSlotOffPause(a) && !!prefs?.[a.slotKey];
}

/** Read a 409 slot_has_dedicated_assignments thrown by apiClient (error.data = body). */
export function parseSlotOffConflict(err: unknown): SlotOffConflict | null {
  const e = err as { status?: number; code?: string; data?: { code?: string; slots?: unknown; stores?: unknown } } | null;
  if (!e || e.status !== 409) return null;
  const body = e.data;
  const code = body?.code ?? e.code;
  if (code !== 'slot_has_dedicated_assignments') return null;
  const stores = Array.isArray(body?.stores) ? body.stores : [];
  const slots = Array.isArray(body?.slots) ? body.slots : [];
  return { code, slots: slots as SlotKey[], stores: stores as SlotOffConflict['stores'] };
}

/** Unique store names joined for the confirm body; blank names use the fallback. */
export function formatStoreNames(
  stores: Array<{ storeName?: string | null }>,
  fallback: string,
  joiner = ', '
): string {
  const names = stores.map((s) => (s.storeName ?? '').trim() || fallback);
  return [...new Set(names)].join(joiner);
}
