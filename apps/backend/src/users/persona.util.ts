import { HttpException, HttpStatus } from '@nestjs/common';
import { isPersonaId, PersonaId } from './persona.types';

export interface UserPersonaShape {
  client?: { id: string } | null;
  agent?: { id: string } | null;
  business?: { id: string } | null;
}

/** Stable `users.user_type_id` for DB compatibility when a user has multiple profiles. */
export function legacyUserTypeIdForPersonas(personas: PersonaId[]): PersonaId {
  const order: PersonaId[] = ['agent', 'business', 'client'];
  for (const p of order) {
    if (personas.includes(p)) return p;
  }
  return personas[0];
}

export function derivePersonas(user: UserPersonaShape): PersonaId[] {
  const out: PersonaId[] = [];
  if (user.client) out.push('client');
  if (user.agent) out.push('agent');
  if (user.business) out.push('business');
  return out;
}

function normalizeHeader(raw: string | undefined): PersonaId | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase();
  return isPersonaId(v) ? v : undefined;
}

/**
 * Resolves active persona from profile rows and optional X-Active-Persona header.
 * Multiple personas require a valid header matching an existing profile.
 */
export function resolveActivePersona(
  user: UserPersonaShape,
  headerRaw: string | undefined
): PersonaId {
  const personas = derivePersonas(user);
  if (personas.length === 0) {
    throw new HttpException(
      'No persona profiles found for this user',
      HttpStatus.FORBIDDEN
    );
  }
  const header = normalizeHeader(headerRaw);
  if (personas.length === 1) {
    const only = personas[0];
    if (!header) return only;
    if (header !== only) {
      throw new HttpException(
        `X-Active-Persona must be "${only}" for this account`,
        HttpStatus.BAD_REQUEST
      );
    }
    return only;
  }
  if (!header) {
    throw new HttpException(
      'X-Active-Persona header is required when the user has multiple personas',
      HttpStatus.BAD_REQUEST
    );
  }
  if (!personas.includes(header)) {
    throw new HttpException(
      `X-Active-Persona "${header}" is not enabled for this account`,
      HttpStatus.BAD_REQUEST
    );
  }
  return header;
}

/**
 * Same as resolveActivePersona but returns null when the header is missing
 * for multi-persona users (no 400). For optional UX endpoints only.
 */
export function resolveActivePersonaLenient(
  user: UserPersonaShape,
  headerRaw: string | undefined
): PersonaId | null {
  const personas = derivePersonas(user);
  if (personas.length === 0) return null;
  if (personas.length === 1) return personas[0];
  const header = normalizeHeader(headerRaw);
  if (!header || !personas.includes(header)) return null;
  return header;
}
