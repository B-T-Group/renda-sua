import { useCallback, useRef } from 'react';

/**
 * Horizontal swipe on a touch surface: finger moves left → next image;
 * finger moves right → previous. Intended for image lightboxes.
 */
export function useSwipeImageNavigation(
  onSwipeToNext: () => void,
  onSwipeToPrevious: () => void,
  enabled: boolean,
  thresholdPx = 56
) {
  const startXRef = useRef<number | null>(null);
  const nextRef = useRef(onSwipeToNext);
  const prevRef = useRef(onSwipeToPrevious);
  nextRef.current = onSwipeToNext;
  prevRef.current = onSwipeToPrevious;

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      startXRef.current = e.touches[0]?.clientX ?? null;
    },
    [enabled]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || startXRef.current == null) return;
      const endX = e.changedTouches[0]?.clientX;
      if (endX == null) return;
      const dx = endX - startXRef.current;
      startXRef.current = null;
      if (dx < -thresholdPx) nextRef.current();
      else if (dx > thresholdPx) prevRef.current();
    },
    [enabled, thresholdPx]
  );

  return { onTouchStart, onTouchEnd };
}
