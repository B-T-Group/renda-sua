import { brandTokens } from '../theme/brandTokens';

export type PersonaSlug = 'client' | 'agent' | 'business';

/**
 * Aligns with app header bar colors per active persona:
 * client reads logo blue, agent reads navy, business reads the purchase green.
 */
export const PERSONA_HEADER_COLORS: Record<
  PersonaSlug,
  { main: string; navUnderline: string }
> = {
  client: {
    main: brandTokens.primary.main,
    navUnderline: brandTokens.tint.primaryStrong,
  },
  agent: {
    main: brandTokens.secondary.main,
    navUnderline: brandTokens.tint.secondaryStrong,
  },
  business: { main: brandTokens.cta.dark, navUnderline: brandTokens.cta.soft },
};
