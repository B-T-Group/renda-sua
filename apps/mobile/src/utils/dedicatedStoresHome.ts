import type { MyDedicatedAssignment } from '../types/dedicatedAgents';

export interface DedicatedHomeStore {
  locationId: string;
  storeName: string;
  slotKeys: string[];
  paused: boolean;
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
  return [...byStore.values()].sort((x, y) => x.storeName.localeCompare(y.storeName));
}
