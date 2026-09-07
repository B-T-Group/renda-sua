import type { MeUser } from '../types/me';
import type { PersonaSlug } from '../types/persona';

const ORDER: PersonaSlug[] = ['client', 'agent', 'business'];

const SUPPORTED_PICKER_ORDER: PersonaSlug[] = ['client', 'agent', 'business'];

export const ALL_APP_PERSONAS: PersonaSlug[] = [...SUPPORTED_PICKER_ORDER];

/** Personas the mobile app may offer or activate (client → agent → business). */
export function supportedAppPersonas(personas: PersonaSlug[]): PersonaSlug[] {
  return SUPPORTED_PICKER_ORDER.filter((p) => personas.includes(p));
}

/** @deprecated Use supportedAppPersonas */
export function mobileAppPersonas(personas: PersonaSlug[]): PersonaSlug[] {
  return supportedAppPersonas(personas);
}

export function orderedSupportedAppPersonas(personas: PersonaSlug[]): PersonaSlug[] {
  return SUPPORTED_PICKER_ORDER.filter((p) => personas.includes(p));
}

/** @deprecated Use orderedSupportedAppPersonas */
export function orderedMobileAppPersonas(personas: PersonaSlug[]): PersonaSlug[] {
  return orderedSupportedAppPersonas(personas);
}

export function derivePersonasFromMeUser(user: MeUser): PersonaSlug[] {
  if (user.personas?.length) {
    return [...new Set(user.personas.filter((p): p is PersonaSlug => ORDER.includes(p as PersonaSlug)))];
  }
  const out: PersonaSlug[] = [];
  if (user.client) out.push('client');
  if (user.agent) out.push('agent');
  if (user.business) out.push('business');
  return out;
}

export function orderedPersonas(personas: PersonaSlug[]): PersonaSlug[] {
  return ORDER.filter((p) => personas.includes(p));
}

/** Personas the user has not enrolled in yet. */
export function missingPersonas(enrolled: PersonaSlug[]): PersonaSlug[] {
  return ALL_APP_PERSONAS.filter((p) => !enrolled.includes(p));
}
