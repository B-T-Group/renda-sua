import type { AuthGateContextKey } from '../types/authGate';

type Copy = { titleKey: string; titleDefault: string; bodyKey: string; bodyDefault: string };

const COPY: Record<AuthGateContextKey, Copy> = {
  favorites: {
    titleKey: 'auth.gate.favorites.title',
    titleDefault: 'Sign in to save favorites',
    bodyKey: 'auth.gate.favorites.body',
    bodyDefault: 'Keep your likes and get restock alerts with a free account.',
  },
  interest: {
    titleKey: 'auth.gate.interest.title',
    titleDefault: 'Sign in to show interest',
    bodyKey: 'auth.gate.interest.body',
    bodyDefault: 'Tell the seller you want this item — we’ll notify you when it’s available.',
  },
  generic: {
    titleKey: 'auth.gate.generic.title',
    titleDefault: 'Sign in to continue',
    bodyKey: 'auth.gate.generic.body',
    bodyDefault: 'Enter your phone or email and we’ll send you a one-time code.',
  },
};

export function getAuthGateContextCopy(context: AuthGateContextKey): Copy {
  return COPY[context] ?? COPY.generic;
}
