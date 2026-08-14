const KEY = 'rs_active_persona_v1';

export type PersonaSlug = 'client' | 'agent' | 'business';

export type ActiveContextKind = 'persona' | 'delegation';

/** Legacy + current shape stored under rs_active_persona_v1 */
export interface StoredActivePersona {
  userId: string;
  /** Present when kind is persona (or legacy records without kind). */
  persona?: PersonaSlug;
  kind?: ActiveContextKind;
  delegationId?: string;
}

export interface StoredActiveContext {
  userId: string;
  kind: ActiveContextKind;
  persona?: PersonaSlug;
  delegationId?: string;
}

export function readStoredActivePersona(): StoredActivePersona | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredActivePersona;
    if (!v?.userId) return null;
    if (v.kind === 'delegation' && v.delegationId) return v;
    if (v.persona) return v;
    return null;
  } catch {
    return null;
  }
}

export function readStoredActiveContext(): StoredActiveContext | null {
  const s = readStoredActivePersona();
  if (!s) return null;
  if (s.kind === 'delegation' && s.delegationId) {
    return {
      userId: s.userId,
      kind: 'delegation',
      delegationId: s.delegationId,
    };
  }
  if (s.persona) {
    return {
      userId: s.userId,
      kind: 'persona',
      persona: s.persona,
    };
  }
  return null;
}

export function writeStoredActivePersona(
  userId: string,
  persona: PersonaSlug
): void {
  localStorage.setItem(
    KEY,
    JSON.stringify({ userId, kind: 'persona', persona } satisfies StoredActivePersona)
  );
}

export function writeStoredActiveDelegation(
  userId: string,
  delegationId: string
): void {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      userId,
      kind: 'delegation',
      delegationId,
    } satisfies StoredActivePersona)
  );
}

export function writeStoredActiveContext(ctx: StoredActiveContext): void {
  if (ctx.kind === 'delegation' && ctx.delegationId) {
    writeStoredActiveDelegation(ctx.userId, ctx.delegationId);
    return;
  }
  if (ctx.persona) {
    writeStoredActivePersona(ctx.userId, ctx.persona);
  }
}

export function clearStoredActivePersona(): void {
  localStorage.removeItem(KEY);
}

/** Value for Axios `X-Active-Persona` if it matches the given user id */
export function activePersonaHeaderForUser(userId: string): string | undefined {
  const s = readStoredActiveContext();
  if (s?.userId === userId && s.kind === 'persona' && s.persona) {
    return s.persona;
  }
  return undefined;
}

/** Value for Axios `X-Active-Delegation` if it matches the given user id */
export function activeDelegationHeaderForUser(
  userId: string
): string | undefined {
  const s = readStoredActiveContext();
  if (s?.userId === userId && s.kind === 'delegation' && s.delegationId) {
    return s.delegationId;
  }
  return undefined;
}

/**
 * Stored persona slug for silent token refreshes. The Auth0 action validates
 * it against the user's allowed personas, so a mismatched value falls back
 * safely server-side. Returns undefined in delegation context.
 */
export function readStoredActivePersonaSlug(): PersonaSlug | undefined {
  const s = readStoredActiveContext();
  if (s?.kind === 'persona') return s.persona;
  return undefined;
}
