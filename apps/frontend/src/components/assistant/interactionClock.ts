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
/** Last pointer position (client px) and when it was seen; mutated in place. */
const pointer = { x: 0, y: 0, at: -Infinity };
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

function trackPointer(e: PointerEvent): void {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.at = now();
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
  ['pointermove', 'pointerdown'].forEach((ev) =>
    window.addEventListener(ev, trackPointer as EventListener, opts)
  );
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

/** Where the pointer was last seen, so the character's eyes can follow it. */
export function lastPointer(): Readonly<typeof pointer> {
  return pointer;
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
