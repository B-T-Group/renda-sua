import type { MyDedicatedAssignment } from '../types/dedicatedAgents';

export interface DedicatedHomeStore {
  locationId: string;
  storeName: string;
  slotKeys: string[];
  paused: boolean;
}

const SLOT_ORDER = ['morning', 'afternoon', 'evening'] as const;

/** Morning → afternoon → evening; unknown keys keep their relative order at the end. */
export function sortDedicatedSlotKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = SLOT_ORDER.indexOf(a as (typeof SLOT_ORDER)[number]);
    const ib = SLOT_ORDER.indexOf(b as (typeof SLOT_ORDER)[number]);
    if (ia < 0 && ib < 0) return a.localeCompare(b);
    if (ia < 0) return 1;
    if (ib < 0) return -1;
    return ia - ib;
  });
}

export type BusinessesHubTab = 'dedicated' | 'referred';

/** Openings the agent can still apply to. Applied and blocked rows do not count. */
export function countApplicableDedicatedOpenings(
  opportunities:
    | Array<{ disabledReason?: string | null; application?: unknown }>
    | null
    | undefined
): number {
  return (opportunities ?? []).filter((row) => !row.disabledReason && !row.application)
    .length;
}

/**
 * Initial My Businesses tab. A route param is ignored when that persona focus is off.
 */
export function resolveBusinessesHubTab(
  param: BusinessesHubTab | undefined,
  showDelivery: boolean,
  showCommercial: boolean
): BusinessesHubTab {
  if (param === 'dedicated' && showDelivery) return 'dedicated';
  if (param === 'referred' && showCommercial) return 'referred';
  if (showDelivery) return 'dedicated';
  return 'referred';
}

/** Agent Home "My dedicated stores": one row per store (removed assignments left out). */
export function groupDedicatedHomeStores(assignments: MyDedicatedAssignment[] | null | undefined): DedicatedHomeStore[] {
  const byStore = new Map<string, DedicatedHomeStore>();
  for (const a of assignments ?? []) {
    if ((a.status as string) === 'removed') continue;
    const row = byStore.get(a.locationId) ?? { locationId: a.locationId, storeName: a.storeName, slotKeys: [], paused: true };
    if (!row.slotKeys.includes(a.slotKey)) row.slotKeys.push(a.slotKey);
    if (a.status === 'active') row.paused = false;
    byStore.set(a.locationId, row);
  }
  return [...byStore.values()]
    .map((s) => ({ ...s, slotKeys: sortDedicatedSlotKeys(s.slotKeys) }))
    .sort((x, y) => x.storeName.localeCompare(y.storeName));
}
