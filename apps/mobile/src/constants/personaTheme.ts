import { lightColors } from '../theme/colors';
import type { PersonaSlug } from '../types/persona';

/** Accent colors per persona. Client is logo blue, agent is navy, business is the purchase green. */
export const PERSONA_ACCENT: Record<PersonaSlug, string> = {
  client: lightColors.primary.main,
  agent: lightColors.secondary.main,
  business: lightColors.cta.dark,
};
