import { useEffect, useRef, useState } from 'react';

function secondsUntil(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 1000));
}

/**
 * Ticks down to an ISO `expiresAt` timestamp, invoking `onExpire` exactly once
 * when it reaches zero. Returns the whole seconds remaining.
 */
export function useCountdown(
  expiresAt: string | null,
  onExpire?: () => void
): number {
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    secondsUntil(expiresAt)
  );
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    firedRef.current = false;
    setSecondsLeft(secondsUntil(expiresAt));

    if (!expiresAt) return;

    const tick = () => {
      const remaining = secondsUntil(expiresAt);
      setSecondsLeft(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
    };

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return secondsLeft;
}
