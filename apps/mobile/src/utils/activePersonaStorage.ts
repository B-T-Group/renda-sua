import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersonaSlug } from '../types/persona';
import type { ActiveContext } from '../types/delegation';

const PERSONA_KEY = '@RendasuaAgent:activePersona_v1';
const CONTEXT_KEY = '@RendasuaAgent:activeContext_v1';
const HASURA_USER_ID_KEY = '@RendasuaAgent:hasuraUserId';

export interface StoredActivePersona {
  userId: string;
  persona: PersonaSlug;
}

export type StoredActiveContext =
  | { userId: string; kind: 'persona'; persona: PersonaSlug }
  | { userId: string; kind: 'delegation'; delegationId: string };

export async function writeHasuraUserId(userId: string): Promise<void> {
  await AsyncStorage.setItem(HASURA_USER_ID_KEY, userId);
}

export async function readHasuraUserId(): Promise<string | null> {
  return AsyncStorage.getItem(HASURA_USER_ID_KEY);
}

export async function writeStoredPersona(userId: string, persona: PersonaSlug): Promise<void> {
  await writeStoredContext({ userId, kind: 'persona', persona });
}

export async function writeStoredContext(ctx: StoredActiveContext): Promise<void> {
  await AsyncStorage.multiSet([
    [CONTEXT_KEY, JSON.stringify(ctx)],
    [
      PERSONA_KEY,
      JSON.stringify(
        ctx.kind === 'persona'
          ? { userId: ctx.userId, persona: ctx.persona }
          : { userId: ctx.userId, persona: null }
      ),
    ],
  ]);
}

export async function readStoredPersona(): Promise<StoredActivePersona | null> {
  const ctx = await readStoredContext();
  if (ctx?.kind === 'persona') {
    return { userId: ctx.userId, persona: ctx.persona };
  }
  return null;
}

export async function readStoredContext(): Promise<StoredActiveContext | null> {
  try {
    const raw = await AsyncStorage.getItem(CONTEXT_KEY);
    if (raw) {
      const v = JSON.parse(raw) as StoredActiveContext;
      if (v?.userId && v.kind === 'persona' && v.persona) return v;
      if (v?.userId && v.kind === 'delegation' && v.delegationId) return v;
    }
    // Legacy persona-only key
    const legacy = await AsyncStorage.getItem(PERSONA_KEY);
    if (!legacy) return null;
    const p = JSON.parse(legacy) as StoredActivePersona;
    if (p?.userId && p?.persona) {
      return { userId: p.userId, kind: 'persona', persona: p.persona };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearActivePersonaStorage(): Promise<void> {
  await AsyncStorage.multiRemove([PERSONA_KEY, CONTEXT_KEY, HASURA_USER_ID_KEY]);
}

/** Headers for Nest: persona XOR delegation based on stored context. */
export async function buildActivePersonaHeaders(): Promise<Record<string, string>> {
  const [stored, hid] = await Promise.all([readStoredContext(), readHasuraUserId()]);
  if (!stored || !hid || stored.userId !== hid) return {};
  if (stored.kind === 'delegation') {
    return { 'X-Active-Delegation': stored.delegationId };
  }
  if (stored.kind === 'persona' && stored.persona) {
    return { 'X-Active-Persona': stored.persona };
  }
  return {};
}

export function activeContextFromStored(
  stored: StoredActiveContext | null
): ActiveContext | null {
  if (!stored) return null;
  if (stored.kind === 'delegation') {
    return { kind: 'delegation', delegationId: stored.delegationId };
  }
  return { kind: 'persona', persona: stored.persona };
}
