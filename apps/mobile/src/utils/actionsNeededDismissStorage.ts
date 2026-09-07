import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISS_KEY = '@RendasuaAgent:actionsNeeded:dismissed';

/** kind -> count when the user dismissed that action item */
export type DismissedActionsMap = Record<string, number>;

export async function readDismissedActions(
  persona: string
): Promise<DismissedActionsMap> {
  try {
    const raw = await AsyncStorage.getItem(`${DISMISS_KEY}:${persona}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissedActionsMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function writeDismissedActions(
  persona: string,
  map: DismissedActionsMap
): Promise<void> {
  await AsyncStorage.setItem(`${DISMISS_KEY}:${persona}`, JSON.stringify(map));
}

export async function dismissAllActions(
  persona: string,
  items: Array<{ kind: string; count?: number }>
): Promise<void> {
  const map: DismissedActionsMap = {};
  for (const item of items) {
    map[item.kind] = item.count ?? 1;
  }
  await writeDismissedActions(persona, map);
}

export function filterDismissedActions<T extends { kind: string; count?: number }>(
  items: T[],
  dismissed: DismissedActionsMap
): T[] {
  return items.filter((item) => {
    const dismissedAt = dismissed[item.kind];
    if (dismissedAt == null) return true;
    return (item.count ?? 1) !== dismissedAt;
  });
}
