import type { PersonaSlug } from '../types/persona';

/**
 * Transient UI state for the delivery-confirm deep link (P2–P4):
 * - `switching`: full-screen overlay while we move to the client persona (≤1 s)
 * - `toast`: "Back to {persona}" for 5 s, once per switch
 * - `wrongAccount`: safe screen, never any order data
 */
export type DeliveryConfirmSwitchState = {
  switching: boolean;
  fromPersona: PersonaSlug | null;
  toastPersona: PersonaSlug | null;
  wrongAccount: boolean;
};

export const SWITCH_OVERLAY_MAX_MS = 1000;
export const BACK_TOAST_MS = 5000;

let state: DeliveryConfirmSwitchState = {
  switching: false,
  fromPersona: null,
  toastPersona: null,
  wrongAccount: false,
};
const listeners = new Set<() => void>();
let overlayTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function set(next: Partial<DeliveryConfirmSwitchState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export const deliveryConfirmSwitch = {
  get: (): DeliveryConfirmSwitchState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Called once when a switch away from `from` starts. */
  begin(from: PersonaSlug): void {
    if (state.switching) return;
    set({ switching: true, fromPersona: from, wrongAccount: false });
    if (overlayTimer) clearTimeout(overlayTimer);
    // Never block the screen longer than the AC allows, even if the switch is slow.
    overlayTimer = setTimeout(() => set({ switching: false }), SWITCH_OVERLAY_MAX_MS);
  },
  /** Called when the confirm screen opened. Shows the back toast once if we switched. */
  finish(): boolean {
    const from = state.switching || state.fromPersona ? state.fromPersona : null;
    if (overlayTimer) clearTimeout(overlayTimer);
    set({ switching: false, fromPersona: null, toastPersona: from });
    if (from) {
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => set({ toastPersona: null }), BACK_TOAST_MS);
    }
    return !!from;
  },
  dismissToast(): void {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastPersona: null });
  },
  showWrongAccount(): void {
    if (overlayTimer) clearTimeout(overlayTimer);
    set({ switching: false, fromPersona: null, wrongAccount: true });
  },
  closeWrongAccount(): void {
    set({ wrongAccount: false });
  },
  /** Test helper. */
  reset(): void {
    if (overlayTimer) clearTimeout(overlayTimer);
    if (toastTimer) clearTimeout(toastTimer);
    state = { switching: false, fromPersona: null, toastPersona: null, wrongAccount: false };
  },
};
