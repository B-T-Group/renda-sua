import { HttpException, HttpStatus } from '@nestjs/common';
import { isPersonaId, PersonaId } from './persona.types';

export interface UserPersonaShape {
  client?: { id: string } | null;
  agent?: { id: string } | null;
  business?: { id: string } | null;
}

/** Which profile rows exist (single place that reads client/agent/business relations). */
export function personasFromProfileRelations(user: UserPersonaShape): PersonaId[] {
  const out: PersonaId[] = [];
  if (user.client) out.push('client');
  if (user.agent) out.push('agent');
  if (user.business) out.push('business');
  return out;
}

/**
 * Whether the user has a given profile row (client / agent / business). Use for onboarding and
 * “can this account enable persona X?” — not for request authorization.
 * For “who is acting in this session?” use {@link isActivePersona} / {@link getActivePersonaOrThrow}
 * (`users.user_type_id`).
 */
export function userHasPersona(
  user: UserPersonaShape & { personas?: PersonaId[] },
  p: PersonaId
): boolean {
  if (user.personas?.length) return user.personas.includes(p);
  return personasFromProfileRelations(user).includes(p);
}

/**
 * True when the session’s active persona is `p` (DB `users.user_type_id`).
 * Use for authorization and API behavior when the user may have multiple profiles.
 */
export function isActivePersona(
  user: { user_type_id?: string | null },
  p: PersonaId
): boolean {
  const id = user.user_type_id;
  return typeof id === 'string' && isPersonaId(id) && id === p;
}

/**
 * Active persona from `users.user_type_id`, validated against enabled profiles.
 * Throws if missing, invalid, or not backed by a profile row.
 */
export function getActivePersonaOrThrow(
  user: UserPersonaShape & { user_type_id?: string | null; personas?: PersonaId[] }
): PersonaId {
  const id = user.user_type_id;
  if (!id || !isPersonaId(id)) {
    throw new HttpException(
      'Active persona (user_type_id) is missing or invalid',
      HttpStatus.BAD_REQUEST
    );
  }
  if (!userHasPersona(user, id)) {
    throw new HttpException(
      'Active persona does not match an enabled profile for this account',
      HttpStatus.BAD_REQUEST
    );
  }
  return id;
}

/** Stable `users.user_type_id` for DB compatibility when a user has multiple profiles. */
export function legacyUserTypeIdForPersonas(personas: PersonaId[]): PersonaId {
  const order: PersonaId[] = ['agent', 'business', 'client'];
  for (const p of order) {
    if (personas.includes(p)) return p;
  }
  return personas[0];
}

export function derivePersonas(
  user: UserPersonaShape & { personas?: PersonaId[] }
): PersonaId[] {
  if (user.personas?.length) return [...user.personas];
  return personasFromProfileRelations(user);
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
  user: UserPersonaShape & { user_type_id?: string; personas?: PersonaId[] },
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
 * Like {@link resolveActivePersona}, but if the user has multiple personas and
 * the header is absent, uses {@link legacyUserTypeIdForPersonas} so JWT-only
 * calls (e.g. right after signup, before the app sends X-Active-Persona) still work.
 * If a header is present it must match an enabled persona (same as strict mode).
 */
export function resolveActivePersonaWithDefault(
  user: UserPersonaShape & { user_type_id?: string; personas?: PersonaId[] },
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
  if (header) {
    if (!personas.includes(header)) {
      throw new HttpException(
        `X-Active-Persona "${header}" is not enabled for this account`,
        HttpStatus.BAD_REQUEST
      );
    }
    return header;
  }
  const fromType =
    user.user_type_id &&
    isPersonaId(user.user_type_id) &&
    personas.includes(user.user_type_id)
      ? user.user_type_id
      : undefined;
  return fromType ?? legacyUserTypeIdForPersonas(personas);
}

/**
 * Same as resolveActivePersona but returns null when the header is missing
 * for multi-persona users (no 400). For optional UX endpoints only.
 */
export function resolveActivePersonaLenient(
  user: UserPersonaShape & { user_type_id?: string; personas?: PersonaId[] },
  headerRaw: string | undefined
): PersonaId | null {
  const personas = derivePersonas(user);
  if (personas.length === 0) return null;
  if (personas.length === 1) return personas[0];
  const header = normalizeHeader(headerRaw);
  if (!header || !personas.includes(header)) return null;
  return header;
}
