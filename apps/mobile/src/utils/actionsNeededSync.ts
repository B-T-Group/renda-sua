/** Notifies all useActionsNeeded hook instances to re-apply dismiss filters. */
type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeActionsNeededRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyActionsNeededRefresh(): void {
  listeners.forEach((listener) => listener());
}
