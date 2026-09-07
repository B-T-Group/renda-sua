import { useCallback } from 'react';
import { useStore } from '../stores/RootStore';
import { useEnrollPersonaNav } from './useEnrollPersonaNav';
import type { HeroSlideId } from '../components/browse/HeroCarousel/heroSlideConfig';
import { navigateToGuestSignup } from '../navigation/rootNavigationRef';
import { trackHeroCtaClicked } from '../utils/ftueAnalytics';

/**
 * Deep-link style actions for marketplace hero slides.
 */
export function useHeroCarouselActions(onScrollToCatalog?: () => void) {
  const { auth, ftue } = useStore();
  const enroll = useEnrollPersonaNav();

  const goSignup = useCallback((persona: 'business' | 'agent' | 'client') => {
    navigateToGuestSignup({ preselectedPersona: persona, source: 'hero' });
  }, []);

  const onHeroSlidePress = useCallback(
    (slideId: HeroSlideId) => {
      trackHeroCtaClicked(slideId, { persona_intent: ftue.personaIntent });
      if (slideId === 'buy_local') {
        onScrollToCatalog?.();
        return;
      }
      if (slideId === 'mobile_money') {
        onScrollToCatalog?.();
        return;
      }
      if (slideId === 'grow_business' || slideId === 'ai_tokens') {
        if (!auth.isAuthenticated) {
          goSignup('business');
          return;
        }
        enroll.goToExplain('business');
        return;
      }
      if (slideId === 'become_courier') {
        if (!auth.isAuthenticated) {
          goSignup('agent');
          return;
        }
        enroll.goToExplain('agent');
      }
    },
    [auth.isAuthenticated, enroll, ftue.personaIntent, goSignup, onScrollToCatalog]
  );

  return { onHeroSlidePress };
}
