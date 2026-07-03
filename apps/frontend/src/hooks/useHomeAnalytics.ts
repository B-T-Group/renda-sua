import { useCallback, useEffect, useRef } from 'react';
import { useTrackSiteEvent, SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK } from './useTrackSiteEvent';

/**
 * Homepage analytics — scroll depth milestones + CTA click tracking.
 * All events reuse the existing `trackSiteEvent` infrastructure.
 */
export function useHomeAnalytics() {
  const { trackSiteEvent } = useTrackSiteEvent();
  const firedMilestones = useRef<Set<number>>(new Set());

  // Scroll depth tracking (25/50/75/100%)
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const pct = Math.round((scrolled / total) * 100);
      const milestones = [25, 50, 75, 100];
      for (const m of milestones) {
        if (pct >= m && !firedMilestones.current.has(m)) {
          firedMilestones.current.add(m);
          void trackSiteEvent({
            eventType: SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK,
            metadata: { action: 'scroll_depth', page: 'home', depth_pct: m },
          });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [trackSiteEvent]);

  const trackPersonaTab = useCallback((persona: string) => {
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK,
      metadata: { action: 'persona_tab_switch', persona, page: 'home' },
    });
  }, [trackSiteEvent]);

  const trackFaqToggle = useCallback((questionKey: string, open: boolean) => {
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK,
      metadata: { action: 'faq_toggle', question_key: questionKey, open, page: 'home' },
    });
  }, [trackSiteEvent]);

  const trackNavClick = useCallback((label: string) => {
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK,
      metadata: { action: 'nav_click', label, page: 'home' },
    });
  }, [trackSiteEvent]);

  return { trackPersonaTab, trackFaqToggle, trackNavClick };
}
