import {
  NUDGE_IDS,
  NUDGE_MAX_PER_SESSION,
  NUDGE_PRODUCT_VIEWS_THRESHOLD,
  type NudgeId,
  type PersonaIntent,
} from '../../constants/onboarding';
import type { FtueStore } from '../../stores/FtueStore';

export type NudgeSurface =
  | 'browse'
  | 'item_detail'
  | 'store_detail'
  | 'cart'
  | 'order_success';

export type NudgeDefinition = {
  id: NudgeId;
  surface: NudgeSurface;
  priority: number;
  titleKey: string;
  titleDefault: string;
  messageKey: string;
  messageDefault: string;
  ctaKey: string;
  ctaDefault: string;
  audience: 'guest' | 'client' | 'any';
};

export const NUDGE_CATALOG: NudgeDefinition[] = [
  {
    id: NUDGE_IDS.sellHere,
    surface: 'browse',
    priority: 20,
    titleKey: 'ftue.nudges.sellHereTitle',
    titleDefault: 'You could sell here',
    messageKey: 'ftue.nudges.sellHereMessage',
    messageDefault: 'Create your store and reach customers nearby.',
    ctaKey: 'ftue.nudges.sellHereCta',
    ctaDefault: 'Create your store',
    audience: 'guest',
  },
  {
    id: NUDGE_IDS.saveFavorites,
    surface: 'item_detail',
    priority: 30,
    titleKey: 'ftue.nudges.saveFavoritesTitle',
    titleDefault: 'Find your items again',
    messageKey: 'ftue.nudges.saveFavoritesMessage',
    messageDefault: 'Create an account to keep shopping across devices.',
    ctaKey: 'ftue.nudges.saveFavoritesCta',
    ctaDefault: 'Create an account',
    audience: 'guest',
  },
  {
    id: NUDGE_IDS.becomeCourier,
    surface: 'browse',
    priority: 15,
    titleKey: 'ftue.nudges.becomeCourierTitle',
    titleDefault: 'Start earning money',
    messageKey: 'ftue.nudges.becomeCourierMessage',
    messageDefault: 'Join as a delivery partner when you are ready.',
    ctaKey: 'ftue.nudges.becomeCourierCta',
    ctaDefault: 'Become a courier',
    audience: 'guest',
  },
  {
    id: NUDGE_IDS.saveCart,
    surface: 'cart',
    priority: 40,
    titleKey: 'ftue.nudges.saveCartTitle',
    titleDefault: 'Your cart is saved',
    messageKey: 'ftue.nudges.saveCartMessage',
    messageDefault: 'Create an account to keep it everywhere.',
    ctaKey: 'ftue.nudges.saveCartCta',
    ctaDefault: 'Create an account',
    audience: 'guest',
  },
  {
    id: NUDGE_IDS.postOrderAccount,
    surface: 'order_success',
    priority: 50,
    titleKey: 'ftue.nudges.postOrderTitle',
    titleDefault: 'Track your orders easily',
    messageKey: 'ftue.nudges.postOrderMessage',
    messageDefault: 'Create an account to see order history and updates.',
    ctaKey: 'ftue.nudges.postOrderCta',
    ctaDefault: 'Create an account',
    audience: 'guest',
  },
];

type ResolveArgs = {
  ftue: FtueStore;
  surface: NudgeSurface;
  isAuthenticated: boolean;
  hasCartItems?: boolean;
  suppress?: boolean;
};

function audienceOk(def: NudgeDefinition, isAuthenticated: boolean): boolean {
  if (def.audience === 'any') return true;
  if (def.audience === 'guest') return !isAuthenticated;
  return isAuthenticated;
}

function triggerOk(
  def: NudgeDefinition,
  ftue: FtueStore,
  hasCartItems?: boolean
): boolean {
  const intent = ftue.personaIntent as PersonaIntent | null;
  const views = ftue.browseCounters.sessionProductViews;
  switch (def.id) {
    case NUDGE_IDS.sellHere:
      return intent === 'sell' || views >= NUDGE_PRODUCT_VIEWS_THRESHOLD;
    case NUDGE_IDS.saveFavorites:
      return views >= NUDGE_PRODUCT_VIEWS_THRESHOLD;
    case NUDGE_IDS.becomeCourier:
      return intent === 'deliver' || views >= NUDGE_PRODUCT_VIEWS_THRESHOLD + 3;
    case NUDGE_IDS.saveCart:
      return !!hasCartItems;
    case NUDGE_IDS.postOrderAccount:
      return true;
    default:
      return false;
  }
}

/** Pick at most one eligible nudge for a surface. */
export function resolveNudge(args: ResolveArgs): NudgeDefinition | null {
  const { ftue, surface, isAuthenticated, hasCartItems, suppress } = args;
  if (suppress) return null;
  if (ftue.sessionNudgeShows >= NUDGE_MAX_PER_SESSION) return null;

  const candidates = NUDGE_CATALOG.filter(
    (d) =>
      d.surface === surface &&
      audienceOk(d, isAuthenticated) &&
      ftue.isNudgeEligible(d.id) &&
      triggerOk(d, ftue, hasCartItems)
  ).sort((a, b) => b.priority - a.priority);

  return candidates[0] ?? null;
}

export const NudgeService = {
  resolve: resolveNudge,
  catalog: NUDGE_CATALOG,
};
