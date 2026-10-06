import { Suspense, lazy, useEffect, useState } from 'react';
import type { AssistantLauncherProps } from './AssistantLauncher';

const AssistantLauncher = lazy(() =>
  import(
    /* webpackChunkName: "assistant-launcher" */
    './AssistantLauncher'
  ).then((m) => ({ default: m.AssistantLauncher }))
);

export interface DeferredAssistantLauncherProps extends AssistantLauncherProps {
  hidden: boolean;
}

/**
 * Idle-mounts the launcher, like DeferredFloatingWhatsApp, so it never renders in
 * launch frames and cannot affect time-to-first-render.
 */
export function DeferredAssistantLauncher({
  hidden,
  ...props
}: DeferredAssistantLauncherProps) {
  const [mount, setMount] = useState(false);

  useEffect(() => {
    if (hidden || mount) return undefined;
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout?: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      idleId = w.requestIdleCallback(() => setMount(true), { timeout: 4000 });
    } else {
      timeoutId = window.setTimeout(() => setMount(true), 2000);
    }
    return () => {
      if (idleId != null && typeof w.cancelIdleCallback === 'function')
        w.cancelIdleCallback(idleId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [hidden, mount]);

  if (hidden || !mount) return null;
  return (
    <Suspense fallback={null}>
      <AssistantLauncher {...props} />
    </Suspense>
  );
}

export default DeferredAssistantLauncher;
