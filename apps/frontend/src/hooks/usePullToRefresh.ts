import { useEffect, useRef } from 'react';

import { skipWaitingAndReload } from '../pwa/registerServiceWorker';

type UsePullToRefreshOptions = {
  enabled?: boolean;
  thresholdPx?: number;
};

function getScrollTop(): number {
  const el = document.scrollingElement as HTMLElement | null;
  return el?.scrollTop ?? window.scrollY ?? 0;
}

async function defaultRefresh() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.waiting) {
        await skipWaitingAndReload();
        return;
      }
    } catch {
      // ignore and fallback to hard reload
    }
  }
  window.location.reload();
}

/**
 * Adds a simple “pull/swipe down to refresh” gesture on touch devices.
 * Triggers only when the page scroll position is at the very top.
 */
export function usePullToRefresh(options: UsePullToRefreshOptions = {}) {
  const { enabled = true, thresholdPx = 80 } = options;

  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (getScrollTop() > 0) return;
      const touch = e.touches[0];
      if (!touch) return;
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      triggeredRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (triggeredRef.current) return;
      if (getScrollTop() > 0) return;

      const touch = e.touches[0];
      if (!touch) return;

      const startY = startYRef.current;
      const startX = startXRef.current;
      if (startY === null || startX === null) return;

      const dy = touch.clientY - startY;
      const dx = touch.clientX - startX;

      // Mostly vertical pull-down.
      if (dy > thresholdPx && Math.abs(dx) < 40) {
        triggeredRef.current = true;
        void defaultRefresh();
      }
    };

    const onTouchEnd = () => {
      startYRef.current = null;
      startXRef.current = null;
      triggeredRef.current = false;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, thresholdPx]);
}

