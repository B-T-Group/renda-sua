import { HttpException, HttpStatus } from '@nestjs/common';
import type { SessionPersonaContext } from '../auth/request-context';
import { isPersonaId, PersonaId } from './persona.types';

export interface UserPersonaShape {
  client?: { id?: string } | null;
  agent?: { id?: string } | null;
  business?: { id?: string } | null;
  /** Set on `/users/me` and other flows after JWT session persona is resolved. */
  active_persona?: PersonaId | null;
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
 * For “who is acting in this session?” use {@link isActivePersona} / {@link resolveSessionPersona}.
 */
export function userHasPersona(
  user: UserPersonaShape & { personas?: PersonaId[] },
  p: PersonaId
): boolean {
  if (user.personas?.length) return user.personas.includes(p);
  return personasFromProfileRelations(user).includes(p);
}

function isAllowedSessionRole(
  role: PersonaId,
  allowed: PersonaId[] | undefined
): boolean {
  return !allowed?.length || allowed.includes(role);
}

/**
 * Active persona for the request:
 * 1. Prefer validated `X-Active-Persona` when enrolled + allowed by JWT
 * 2. Else JWT `x-hasura-default-role`, validated against allowed roles + profiles
 *
 * Header preference keeps multi-persona clients working when the UI has switched
 * but the access token still carries a stale default role.
 */
export function resolveSessionPersona(
  user: UserPersonaShape & { personas?: PersonaId[] },
  ctx: SessionPersonaContext
): PersonaId {
  const personas = derivePersonas(user);
  if (personas.length === 0) {
    throw new HttpException(
      'No persona profiles found for this user',
      HttpStatus.FORBIDDEN
    );
  }

  const headerRaw = ctx.activePersona?.trim().toLowerCase();
  if (headerRaw && isPersonaId(headerRaw)) {
    if (
      userHasPersona(user, headerRaw) &&
      isAllowedSessionRole(headerRaw, ctx.jwtAllowedRoles)
    ) {
      return headerRaw;
    }
  }

  const role = ctx.jwtDefaultRole;
  if (!role || !isPersonaId(role)) {
    throw new HttpException(
      'Missing or invalid x-hasura-default-role in JWT',
      HttpStatus.UNAUTHORIZED
    );
  }
  if (!isAllowedSessionRole(role, ctx.jwtAllowedRoles)) {
    throw new HttpException(
      'JWT default role is not in allowed roles',
      HttpStatus.FORBIDDEN
    );
  }
  if (!userHasPersona(user, role)) {
    throw new HttpException(
      'Active persona does not match an enabled profile for this account',
      HttpStatus.BAD_REQUEST
    );
  }
  return role;
}

/**
 * True when the session’s active persona is `p` (from JWT via `user.active_persona`).
 */
export function isActivePersona(
  user: UserPersonaShape & { active_persona?: PersonaId | null },
  p: PersonaId
): boolean {
  const id = user.active_persona;
  return typeof id === 'string' && isPersonaId(id) && id === p;
}

/**
 * Active persona from `user.active_persona`, validated against enabled profiles.
 */
export function getActivePersonaOrThrow(
  user: UserPersonaShape & {
    active_persona?: PersonaId | null;
    personas?: PersonaId[];
  }
): PersonaId {
  const id = user.active_persona;
  if (!id || !isPersonaId(id)) {
    throw new HttpException(
      'Active persona is missing or invalid',
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

/** Resolves active persona from JWT claims (strict). */
export function resolveActivePersona(
  user: UserPersonaShape & { personas?: PersonaId[] },
  ctx: SessionPersonaContext
): PersonaId {
  return resolveSessionPersona(user, ctx);
}

/** Alias for {@link resolveSessionPersona}. */
export function resolveActivePersonaWithDefault(
  user: UserPersonaShape & { personas?: PersonaId[] },
  ctx: SessionPersonaContext
): PersonaId {
  return resolveSessionPersona(user, ctx);
}

/** Returns null when JWT persona cannot be resolved (optional UX endpoints only). */
export function resolveActivePersonaLenient(
  user: UserPersonaShape & { personas?: PersonaId[] },
  ctx: SessionPersonaContext
): PersonaId | null {
  try {
    return resolveSessionPersona(user, ctx);
  } catch {
    return null;
  }
}
