import { brandTokens } from '../theme/brandTokens';

export type PersonaSlug = 'client' | 'agent' | 'business';

/**
 * Aligns with app header bar colors per active persona (Trust Coast Blue):
 * client reads primary blue, agent reads delivery teal, business reads the
 * warm accent family.
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
  business: { main: brandTokens.cta.main, navUnderline: brandTokens.cta.soft },
};
