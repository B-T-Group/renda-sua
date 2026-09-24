export type AuthGateContextKey =
  | 'favorites'
  | 'checkout'
  | 'interest'
  | 'foods_cart'
  | 'generic';

export type AuthGateIntent = {
  context: AuthGateContextKey;
  /** Funnel entry slug, e.g. save_favorites, interest_card */
  entry: string;
  run?: () => void | Promise<void>;
};

export type AuthGateStep = 'identifier' | 'code' | 'finish';
