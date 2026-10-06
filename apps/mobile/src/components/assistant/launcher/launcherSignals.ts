/**
 * Process-wide signals for the floating assistant launcher: an open-overlay
 * counter (modals, bottom sheets, drawers) and the last user interaction time
 * (touch / scroll) used for the 20 s settle and the attention idle wait.
 * Plain module state, no React, so it is unit-tested and cheap to call.
 */

type Listener = () => void;

function createSignal() {
  const listeners = new Set<Listener>();
  return {
    emit: () => listeners.forEach((l) => l()),
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

let suppressionCount = 0;
const suppressionSignal = createSignal();

/** Hide the launcher while an overlay is open. Returns an idempotent release. */
export function acquireLauncherSuppression(): () => void {
  suppressionCount += 1;
  suppressionSignal.emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suppressionCount = Math.max(0, suppressionCount - 1);
    suppressionSignal.emit();
  };
}

export function launcherSuppressionCount(): number {
  return suppressionCount;
}

export const subscribeLauncherSuppression = suppressionSignal.subscribe;

let lastInteractionAt = Date.now();
const interactionSignal = createSignal();

export function markLauncherInteraction(now: number = Date.now()): void {
  lastInteractionAt = now;
  interactionSignal.emit();
}

export function lastLauncherInteractionAt(): number {
  return lastInteractionAt;
}

export const subscribeLauncherInteraction = interactionSignal.subscribe;

/** Test-only reset. */
export function __resetLauncherSignals(now = 0): void {
  suppressionCount = 0;
  lastInteractionAt = now;
}
