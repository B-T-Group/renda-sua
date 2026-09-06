import type { PersonaSlug } from '../types/persona';

/** Accent colors per persona (aligned with web `personaTheme` — Trust Coast Blue palette). */
export const PERSONA_ACCENT: Record<PersonaSlug, string> = {
  client: '#1E3A8A',
  agent: '#0F766E',
  business: '#C2410C',
};
