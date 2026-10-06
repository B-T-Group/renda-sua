import { useEffect, useState, useSyncExternalStore } from 'react';
import { InteractionManager, Keyboard } from 'react-native';
import { rootNavigationRef } from '../../../navigation/rootNavigationRef';
import { lastLauncherInteractionAt, subscribeLauncherInteraction } from './launcherSignals';

/** Deepest focused route name of the root navigation container. */
export function useFocusedRouteName(): string | undefined {
  const [name, setName] = useState<string | undefined>(() =>
    rootNavigationRef.isReady() ? rootNavigationRef.getCurrentRoute()?.name : undefined
  );
  useEffect(() => {
    const read = () => {
      if (rootNavigationRef.isReady()) setName(rootNavigationRef.getCurrentRoute()?.name);
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

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
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
