import { describe, it, expect } from 'vitest';
import { getMentionableParticipants, resolvePersonaForOrder } from './messaging';
import type { MentionableParticipant } from '../services/agentApi';

const ALL_PARTICIPANTS: MentionableParticipant[] = [
  { userId: 'client-1', persona: 'client', displayName: 'Alice' },
  { userId: 'biz-1', persona: 'business', displayName: 'Bob Corp' },
  { userId: 'agent-1', persona: 'agent', displayName: 'Carol' },
];

describe('getMentionableParticipants', () => {
  it('excludes self and returns allowed personas for client', () => {
    const result = getMentionableParticipants(ALL_PARTICIPANTS, 'client-1', 'client');
    expect(result.find((p) => p.userId === 'client-1')).toBeUndefined();
    expect(result.some((p) => p.persona === 'agent')).toBe(true);
    expect(result.some((p) => p.persona === 'business')).toBe(true);
  });

  it('excludes self and returns allowed personas for agent', () => {
    const result = getMentionableParticipants(ALL_PARTICIPANTS, 'agent-1', 'agent');
    expect(result.find((p) => p.userId === 'agent-1')).toBeUndefined();
    expect(result.some((p) => p.persona === 'client')).toBe(true);
    expect(result.some((p) => p.persona === 'business')).toBe(true);
  });

  it('excludes self and returns allowed personas for business', () => {
    const result = getMentionableParticipants(ALL_PARTICIPANTS, 'biz-1', 'business');
    expect(result.find((p) => p.userId === 'biz-1')).toBeUndefined();
    expect(result.some((p) => p.persona === 'client')).toBe(true);
    expect(result.some((p) => p.persona === 'agent')).toBe(true);
  });
});

describe('resolvePersonaForOrder', () => {
  const order = {
    client: { user_id: 'client-1' },
    business: { user_id: 'biz-1' },
    assigned_agent: { user_id: 'agent-1' },
  };

  it('resolves client', () => expect(resolvePersonaForOrder(order, 'client-1')).toBe('client'));
  it('resolves business', () => expect(resolvePersonaForOrder(order, 'biz-1')).toBe('business'));
  it('resolves agent', () => expect(resolvePersonaForOrder(order, 'agent-1')).toBe('agent'));
  it('returns null for unknown', () => expect(resolvePersonaForOrder(order, 'nobody')).toBeNull());
});
