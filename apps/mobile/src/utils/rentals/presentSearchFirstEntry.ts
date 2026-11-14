/** Hide the #811 header once the Rentals tab exists. The Next rental card stays. */
export function presentSearchFirstEntry<T extends { onPress?: () => void; next: unknown }>(
  entry: T | undefined,
  hideHeader: boolean
): T | undefined {
  if (!entry || !hideHeader) return entry;
  if (!entry.next) return undefined;
  return { ...entry, onPress: undefined };
}
