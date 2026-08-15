import {
  activeDelegationHeaderForUser,
  activePersonaHeaderForUser,
  clearStoredActivePersona,
  readStoredActiveContext,
  readStoredActivePersona,
  readStoredActivePersonaSlug,
  writeStoredActiveContext,
  writeStoredActiveDelegation,
  writeStoredActivePersona,
} from './activePersonaStorage';

describe('activePersonaStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads a legacy persona record without kind', () => {
    localStorage.setItem(
      'rs_active_persona_v1',
      JSON.stringify({ userId: 'u1', persona: 'business' })
    );
    expect(readStoredActivePersona()).toEqual({
      userId: 'u1',
      persona: 'business',
    });
    expect(readStoredActiveContext()).toEqual({
      userId: 'u1',
      kind: 'persona',
      persona: 'business',
    });
    expect(activePersonaHeaderForUser('u1')).toBe('business');
    expect(activeDelegationHeaderForUser('u1')).toBeUndefined();
  });

  it('stores a delegation context and never sends a persona header', () => {
    writeStoredActiveDelegation('u1', 'grant-1');
    expect(readStoredActiveContext()).toEqual({
      userId: 'u1',
      kind: 'delegation',
      delegationId: 'grant-1',
    });
    expect(activeDelegationHeaderForUser('u1')).toBe('grant-1');
    expect(activePersonaHeaderForUser('u1')).toBeUndefined();
    expect(readStoredActivePersonaSlug()).toBeUndefined();
    expect(activeDelegationHeaderForUser('other')).toBeUndefined();
  });

  it('writes persona context through writeStoredActiveContext', () => {
    writeStoredActiveContext({
      userId: 'u2',
      kind: 'persona',
      persona: 'agent',
    });
    expect(activePersonaHeaderForUser('u2')).toBe('agent');
    expect(activeDelegationHeaderForUser('u2')).toBeUndefined();
    writeStoredActivePersona('u2', 'client');
    expect(activePersonaHeaderForUser('u2')).toBe('client');
  });

  it('returns null for invalid JSON or incomplete records', () => {
    localStorage.setItem('rs_active_persona_v1', '{not-json');
    expect(readStoredActivePersona()).toBeNull();
    localStorage.setItem(
      'rs_active_persona_v1',
      JSON.stringify({ userId: 'u1', kind: 'delegation' })
    );
    expect(readStoredActivePersona()).toBeNull();
    clearStoredActivePersona();
    expect(readStoredActiveContext()).toBeNull();
  });
});
