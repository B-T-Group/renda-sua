import type { PersonaSlug } from '../types/persona';

const PERSONAS: PersonaSlug[] = ['client', 'agent', 'business'];

export function parsePersonaFromPushData(
  data: Record<string, unknown> | undefined
): PersonaSlug | null {
  if (!data) return null;
  const raw = data.persona;
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return PERSONAS.includes(v as PersonaSlug) ? (v as PersonaSlug) : null;
}

/** True when the user can switch into `target` from the current session. */
export function canSwitchToPersona(params: {
  isAuthenticated: boolean;
  showMainApp: boolean;
  activePersona: PersonaSlug;
  enrolled: PersonaSlug[];
  pickingPersona: PersonaSlug | null;
  target: PersonaSlug;
}): boolean {
  return (
    params.isAuthenticated &&
    params.showMainApp &&
    params.activePersona !== params.target &&
    params.enrolled.includes(params.target) &&
    !params.pickingPersona
  );
}

export function isOnPersona(params: {
  isAuthenticated: boolean;
  showMainApp: boolean;
  activePersona: PersonaSlug;
  target: PersonaSlug;
}): boolean {
  return (
    params.isAuthenticated &&
    params.showMainApp &&
    params.activePersona === params.target
  );
}
