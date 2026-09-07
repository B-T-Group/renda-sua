import type { PersonaIntent } from '../../../constants/onboarding';
import type { PersonaSlug } from '../../../types/persona';

export type HeroSlideId =
  | 'buy_local'
  | 'grow_business'
  | 'become_courier'
  | 'ai_tokens'
  | 'mobile_money';

export type HeroSlideConfig = {
  id: HeroSlideId;
  titleKey: string;
  titleDefault: string;
  ctaKey: string;
  ctaDefault: string;
  icon: 'shopping-outline' | 'storefront-outline' | 'moped' | 'auto-fix' | 'cellphone';
};

const ALL_SLIDES: HeroSlideConfig[] = [
  {
    id: 'buy_local',
    titleKey: 'ftue.hero.buyLocal',
    titleDefault: 'Shop local',
    ctaKey: 'ftue.hero.buyLocalCta',
    ctaDefault: 'Browse products',
    icon: 'shopping-outline',
  },
  {
    id: 'grow_business',
    titleKey: 'ftue.hero.growBusiness',
    titleDefault: 'Grow your business',
    ctaKey: 'ftue.hero.growBusinessCta',
    ctaDefault: 'Start selling',
    icon: 'storefront-outline',
  },
  {
    id: 'become_courier',
    titleKey: 'ftue.hero.becomeCourier',
    titleDefault: 'Become a delivery partner',
    ctaKey: 'ftue.hero.becomeCourierCta',
    ctaDefault: 'Start delivering',
    icon: 'moped',
  },
  {
    id: 'ai_tokens',
    titleKey: 'ftue.hero.aiTokens',
    titleDefault: '20 free AI tokens',
    ctaKey: 'ftue.hero.aiTokensCta',
    ctaDefault: 'Claim tokens',
    icon: 'auto-fix',
  },
  {
    id: 'mobile_money',
    titleKey: 'ftue.hero.mobileMoney',
    titleDefault: 'Mobile Money payments',
    ctaKey: 'ftue.hero.mobileMoneyCta',
    ctaDefault: 'Learn more',
    icon: 'cellphone',
  },
];

export type HeroSlideOptions = {
  personaIntent: PersonaIntent | null;
  activePersona?: PersonaSlug | null;
  /** Hide Mobile Money slide when country is Stripe-only. */
  showMobileMoney?: boolean;
  /** Hide AI tokens after merchant conversion. */
  showAiTokens?: boolean;
};

function prioritize(
  slides: HeroSlideConfig[],
  firstId: HeroSlideId
): HeroSlideConfig[] {
  const first = slides.find((s) => s.id === firstId);
  if (!first) return slides;
  return [first, ...slides.filter((s) => s.id !== firstId)];
}

/** Pure, unit-testable slide ordering for the marketplace hero. */
export function buildHeroSlides(options: HeroSlideOptions): HeroSlideConfig[] {
  let slides = [...ALL_SLIDES];

  if (options.showMobileMoney === false) {
    slides = slides.filter((s) => s.id !== 'mobile_money');
  }
  if (options.showAiTokens === false) {
    slides = slides.filter((s) => s.id !== 'ai_tokens');
  }

  if (options.activePersona === 'business') {
    slides = slides.filter((s) => s.id !== 'become_courier');
    return prioritize(slides, 'grow_business');
  }
  if (options.activePersona === 'agent') {
    slides = slides.filter((s) => s.id !== 'grow_business' && s.id !== 'ai_tokens');
    return prioritize(slides, 'become_courier');
  }

  if (options.personaIntent === 'sell') {
    return prioritize(slides, 'grow_business');
  }
  if (options.personaIntent === 'deliver') {
    return prioritize(slides, 'become_courier');
  }
  if (options.personaIntent === 'buy') {
    return prioritize(slides, 'buy_local');
  }
  return slides;
}
