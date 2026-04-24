import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';

type HorizontalScrollEdgeState = {
  isScrollable: boolean;
  showLeftFade: boolean;
  showRightFade: boolean;
};

const EPS = 2;

function compute(
  el: HTMLDivElement | null
): HorizontalScrollEdgeState {
  if (!el) {
    return { isScrollable: false, showLeftFade: false, showRightFade: false };
  }
  const { scrollLeft, clientWidth, scrollWidth } = el;
  const isScrollable = scrollWidth - clientWidth > EPS;
  if (!isScrollable) {
    return { isScrollable: false, showLeftFade: false, showRightFade: false };
  }
  return {
    isScrollable: true,
    showLeftFade: scrollLeft > EPS,
    showRightFade: scrollLeft + clientWidth < scrollWidth - EPS,
  };
}

export function useHorizontalScrollEdges(
  ref: RefObject<HTMLDivElement | null>
): HorizontalScrollEdgeState {
  const [state, setState] = useState<HorizontalScrollEdgeState>(() =>
    compute(ref.current)
  );

  const refresh = useCallback(() => {
    setState(compute(ref.current));
  }, [ref]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => refresh();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ref, refresh]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => refresh());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, refresh]);

  // If children change width without resizing the element itself, recompute.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mo = new MutationObserver(() => refresh());
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [ref, refresh]);

  return state;
}
