/**
 * Shared "last interaction" clock for the Renda character settle rule (spec §1:
 * after 20 s with no touch, scroll or pointer the hero/launcher eases to static,
 * and resumes on interaction or screen focus).
 */
type Listener = () => void;

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

let lastInteraction = now();
let installed = false;
const listeners = new Set<Listener>();
let notifyQueued = false;

function touch(): void {
  lastInteraction = now();
  if (notifyQueued || listeners.size === 0) return;
  notifyQueued = true;
  // Coalesce bursts (pointermove/scroll) into one notification per task.
  setTimeout(() => {
    notifyQueued = false;
    listeners.forEach((l) => l());
  }, 0);
}

function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  [
    'pointermove',
    'pointerdown',
    'keydown',
    'wheel',
    'scroll',
    'touchstart',
  ].forEach((ev) => window.addEventListener(ev, touch, opts));
  window.addEventListener('focus', touch);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') touch();
    });
  }
}

export function msSinceInteraction(): number {
  return now() - lastInteraction;
}

export function onInteraction(listener: Listener): () => void {
  install();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test helper. */
export function __resetInteractionClock(): void {
  lastInteraction = now();
}
