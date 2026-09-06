type Listener = (enabled: boolean) => void;

const listeners = new Set<Listener>();

export function notifyTipsRemindersChanged(enabled: boolean): void {
  listeners.forEach((l) => l(enabled));
}

export function subscribeTipsRemindersChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
