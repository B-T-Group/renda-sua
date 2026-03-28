const KEY = 'rs_active_persona_v1';

export type PersonaSlug = 'client' | 'agent' | 'business';

export interface StoredActivePersona {
  userId: string;
  persona: PersonaSlug;
}

export function readStoredActivePersona(): StoredActivePersona | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredActivePersona;
    if (v?.userId && v?.persona) return v;
    return null;
  } catch {
    return null;
  }
}

export function writeStoredActivePersona(userId: string, persona: PersonaSlug): void {
  localStorage.setItem(KEY, JSON.stringify({ userId, persona }));
}

export function clearStoredActivePersona(): void {
  localStorage.removeItem(KEY);
}

/** Value for Axios `X-Active-Persona` if it matches the given user id */
export function activePersonaHeaderForUser(userId: string): string | undefined {
  const s = readStoredActivePersona();
  if (s?.userId === userId && s.persona) return s.persona;
  return undefined;
}
