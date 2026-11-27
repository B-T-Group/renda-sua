const DISMISS_FALLBACK_MS = 700;

export interface ModalDismissWaiter {
  /** Pass to the Modal's `onDismiss`. */
  onDismiss: () => void;
  /** Call before hiding the Modal; resolves once it is gone (or after a fallback delay). */
  wait: () => Promise<void>;
}

/**
 * On iOS a native sheet (Stripe PaymentSheet) presented while a React Native Modal is still
 * dismissing attaches to that Modal and disappears with it. Await `wait()` before presenting.
 * The fallback covers platforms or cases where `onDismiss` never fires.
 */
export function createModalDismissWaiter(fallbackMs = DISMISS_FALLBACK_MS): ModalDismissWaiter {
  let pending: (() => void) | null = null;
  return {
    onDismiss: () => pending?.(),
    wait: () =>
      new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          pending = null;
          resolve();
        };
        const timer = setTimeout(done, fallbackMs);
        pending = done;
      }),
  };
}
