import type { AuthGateContextKey } from '../types/authGate';

type Copy = { titleKey: string; titleDefault: string; bodyKey: string; bodyDefault: string };

const COPY: Record<AuthGateContextKey, Copy> = {
  favorites: {
    titleKey: 'auth.gate.favorites.title',
    titleDefault: 'Save your favorites',
    bodyKey: 'auth.gate.favorites.body',
    bodyDefault: 'Sign in to keep this item and find it on any device.',
  },
  checkout: {
    titleKey: 'auth.gate.checkout.title',
    titleDefault: 'Sign in to check out',
    bodyKey: 'auth.gate.checkout.body',
    bodyDefault:
      "We'll send you a code to confirm it's you. Your cart stays as it is.",
  },
  interest: {
    titleKey: 'auth.gate.interest.title',
    titleDefault: "Tell the seller you're interested",
    bodyKey: 'auth.gate.interest.body',
    bodyDefault: 'Sign in so the seller can get back to you about this item.',
  },
  foods_cart: {
    titleKey: 'auth.gate.foodsCart.title',
    titleDefault: 'Sign in to add to your cart',
    bodyKey: 'auth.gate.foodsCart.body',
    bodyDefault:
      'Your cart is saved to your account, so you can check out on any device.',
  },
  generic: {
    titleKey: 'auth.gate.generic.title',
    titleDefault: 'Sign in to continue',
    bodyKey: 'auth.gate.generic.body',
    bodyDefault: "We'll send you a code. No password needed.",
  },
};

export function getAuthGateContextCopy(context: AuthGateContextKey): Copy {
  return COPY[context] ?? COPY.generic;
}
