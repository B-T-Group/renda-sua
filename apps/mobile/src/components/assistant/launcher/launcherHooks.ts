import { useEffect, useState, useSyncExternalStore } from 'react';
import { InteractionManager, Keyboard, Platform } from 'react-native';
import { useClientFlags } from '../../../contexts/ClientFlagsContext';
import { rootNavigationRef } from '../../../navigation/rootNavigationRef';
import { SETTLE_AFTER_MS } from '../../../utils/assistantLauncher';
import { lastLauncherInteractionAt, subscribeLauncherInteraction } from './launcherSignals';

/** Deepest focused route name of the (untyped) root navigation container. */
export function currentRouteName(): string | undefined {
  if (!rootNavigationRef.isReady()) return undefined;
  const route = rootNavigationRef.getCurrentRoute() as { name?: string } | undefined;
  return route?.name;
}

export function useFocusedRouteName(): string | undefined {
  const [name, setName] = useState<string | undefined>(currentRouteName);
  useEffect(() => {
    const read = () => {
      if (rootNavigationRef.isReady()) setName(currentRouteName());
    };
    read();
    const off = rootNavigationRef.addListener('state', read);
    return off;
  }, []);
  return name;
}

/** Mount after interactions + `delayMs`, so the launcher never renders in launch frames. */
export function useDeferredMount(delayMs: number, enabled: boolean): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!enabled || mounted) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => setMounted(true), delayMs);
    });
    return () => {
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [delayMs, enabled, mounted]);
  return mounted;
}

/**
 * iOS has will-events, so the launcher hides as the keyboard starts to slide
 * in (not after); Android only emits did-events.
 */
export const KEYBOARD_EVENTS =
  Platform.OS === 'ios'
    ? ({ show: 'keyboardWillShow', hide: 'keyboardWillHide' } as const)
    : ({ show: 'keyboardDidShow', hide: 'keyboardDidHide' } as const);

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(KEYBOARD_EVENTS.show, () => setOpen(true));
    const hide = Keyboard.addListener(KEYBOARD_EVENTS.hide, () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

export function useLastInteractionAt(): number {
  return useSyncExternalStore(subscribeLauncherInteraction, lastLauncherInteractionAt);
}

/**
 * True after 20 s with no touch / scroll (spec "settle"); any interaction or
 * a change of `resetKey` (e.g. screen focus, route) resumes.
 */
export function useInteractionSettled(resetKey?: unknown): boolean {
  const lastInteractionAt = useLastInteractionAt();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const elapsed = Date.now() - lastInteractionAt;
    const timer = setTimeout(() => setSettled(true), Math.max(0, SETTLE_AFTER_MS - Math.max(0, elapsed)));
    return () => clearTimeout(timer);
  }, [lastInteractionAt, resetKey]);
  return settled;
}

/** Process-wide: client flags have resolved (success or failure) at least once. */
let clientFlagsResolvedOnce = false;

/**
 * True once the first client-flags fetch has settled; stays true through later
 * market refetches (`loading` flips back to true on each one). Lets flag-driven
 * entry points render once with the real value instead of flashing the default.
 */
export function useClientFlagsResolved(): boolean {
  const { loading } = useClientFlags();
  if (!loading) clientFlagsResolvedOnce = true;
  return clientFlagsResolvedOnce;
}
