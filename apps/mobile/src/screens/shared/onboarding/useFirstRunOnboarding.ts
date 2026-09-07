import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { OnboardingScreenId, PersonaIntent } from '../../../constants/onboarding';
import { useStore } from '../../../stores/RootStore';
import {
  trackOnboardingCompleted,
  trackOnboardingScreenViewed,
  trackOnboardingSkipped,
  trackOnboardingStarted,
  trackPersonaIntentSelected,
} from '../../../utils/ftueAnalytics';
import type { OnboardingBullet } from '../../../components/onboarding/OnboardingSlide';

export type OnboardingFinishResult = {
  intent: PersonaIntent;
  outcome: 'completed' | 'skipped';
};

export type OnboardingPage =
  | { id: OnboardingScreenId; kind: 'slide' }
  | { id: 'intent'; kind: 'intent' };

const PAGES: OnboardingPage[] = [
  { id: 'marketplace', kind: 'slide' },
  { id: 'merchant', kind: 'slide' },
  { id: 'payments', kind: 'slide' },
  { id: 'intent', kind: 'intent' },
];

type Options = {
  onFinished: (result: OnboardingFinishResult) => void;
};

export function useFirstRunOnboarding({ onFinished }: Options) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { ftue, market } = useStore();
  const [index, setIndex] = useState(0);
  const startedRef = useRef(false);
  const countryCode = market.selectedCountryCode;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackOnboardingStarted({ country_code: countryCode });
    trackOnboardingScreenViewed('marketplace', 0, { country_code: countryCode });
  }, [countryCode]);

  const page = PAGES[index] ?? PAGES[0];
  const isLastSlide = index === PAGES.length - 2;
  const isIntent = page.kind === 'intent';

  const showSkip =
    ftue.skipTimingVariant === 'immediate' || index >= 1;

  const marketplaceBullets: OnboardingBullet[] = useMemo(
    () => [
      {
        icon: 'storefront-outline',
        text: t('ftue.onboarding.slide1.b1', 'Shop from local businesses'),
      },
      {
        icon: 'truck-fast-outline',
        text: t('ftue.onboarding.slide1.b2', 'Fast delivery'),
      },
      {
        icon: 'shield-lock-outline',
        text: t('ftue.onboarding.slide1.b3', 'Secure payments'),
      },
      {
        icon: 'map-marker-radius-outline',
        text: t(
          'ftue.onboarding.slide1.b4',
          'Find shops around you on the map'
        ),
      },
    ],
    [t]
  );

  const merchantBullets: OnboardingBullet[] = useMemo(
    () => [
      {
        icon: 'store-plus-outline',
        text: t('ftue.onboarding.slide2.b1', 'Online store ready in minutes'),
      },
      {
        icon: 'robot-outline',
        text: t('ftue.onboarding.slide2.b2', 'AI-generated product descriptions'),
      },
      {
        icon: 'image-edit-outline',
        text: t(
          'ftue.onboarding.slide2.b3',
          '20 free AI tokens to improve your photos'
        ),
      },
      {
        icon: 'facebook',
        text: t(
          'ftue.onboarding.slide2.b4',
          'Facebook ads to attract more customers'
        ),
      },
      {
        icon: 'cellphone',
        text: t(
          'ftue.onboarding.slide2.b5',
          'Simple management from your phone'
        ),
      },
    ],
    [t]
  );

  const onIndexChange = useCallback(
    (next: number) => {
      setIndex(next);
      const p = PAGES[next];
      if (p) {
        trackOnboardingScreenViewed(p.id, next, { country_code: countryCode });
      }
    },
    [countryCode]
  );

  const goNext = useCallback(() => {
    if (index < PAGES.length - 1) {
      onIndexChange(index + 1);
    }
  }, [index, onIndexChange]);

  const finish = useCallback(
    async (intent: PersonaIntent, outcome: 'completed' | 'skipped') => {
      trackPersonaIntentSelected(intent, {
        country_code: countryCode,
        source: 'onboarding',
      });
      if (outcome === 'skipped') {
        trackOnboardingSkipped(page.id, {
          persona_intent: intent,
          country_code: countryCode,
        });
      }
      trackOnboardingCompleted({
        persona_intent: intent,
        country_code: countryCode,
        outcome,
      });
      await ftue.completeOnboarding(outcome, intent);
      onFinished({ intent, outcome });
    },
    [countryCode, ftue, onFinished, page.id]
  );

  const onSkip = useCallback(() => {
    onIndexChange(PAGES.length - 1);
  }, [onIndexChange]);

  const onSelectIntent = useCallback(
    (intent: PersonaIntent) => {
      void finish(intent, 'completed');
    },
    [finish]
  );

  return {
    width,
    pages: PAGES,
    index,
    page,
    isLastSlide,
    isIntent,
    showSkip,
    marketplaceBullets,
    merchantBullets,
    onIndexChange,
    goNext,
    onSkip,
    onSelectIntent,
    ctaLabel: isLastSlide
      ? t('ftue.onboarding.start', 'Get started')
      : t('ftue.onboarding.continue', 'Continue'),
  };
}
