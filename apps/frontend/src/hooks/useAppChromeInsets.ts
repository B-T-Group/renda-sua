import { useLayoutEffect, useState } from 'react';

/**
 * Elements that permanently cover part of the viewport mark themselves with
 * `data-app-chrome`: `top` (the sticky site AppBar) and `bottom-nav` (the fixed
 * mobile bottom navigation). Full-height pages measure them instead of guessing.
 */
export const APP_CHROME_TOP = 'top';
export const APP_CHROME_BOTTOM_NAV = 'bottom-nav';

export type AppChromeInsets = { top: number; bottom: number };

function heightOf(kind: string): number {
  if (typeof document === 'undefined') return 0;
  const el = document.querySelector<HTMLElement>(`[data-app-chrome="${kind}"]`);
  if (!el) return 0;
  if (getComputedStyle(el).display === 'none') return 0;
  return Math.round(el.getBoundingClientRect().height);
}

function measure(): AppChromeInsets {
  return { top: heightOf(APP_CHROME_TOP), bottom: heightOf(APP_CHROME_BOTTOM_NAV) };
}

/** Live heights of the site top bar and mobile bottom nav, in CSS px. */
export function useAppChromeInsets(): AppChromeInsets {
  const [insets, setInsets] = useState<AppChromeInsets>(() => measure());

  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      const next = measure();
      setInsets((prev) =>
        prev.top === next.top && prev.bottom === next.bottom ? prev : next
      );
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();

    // Bars resize when they wrap (e.g. the two-row guest header on wide screens).
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    const observeBars = () => {
      if (!resizeObserver) return;
      resizeObserver.disconnect();
      document
        .querySelectorAll('[data-app-chrome]')
        .forEach((el) => resizeObserver.observe(el));
    };
    observeBars();

    // Bars mount and unmount with the breakpoint and auth state.
    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            observeBars();
            schedule();
          })
        : null;
    mutationObserver?.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return insets;
}
