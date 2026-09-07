import { describe, expect, it } from 'vitest';
import {
  derivePersonasFromMeUser,
  orderedSupportedAppPersonas,
  supportedAppPersonas,
} from './personaFromMe';
import type { MeUser } from '../types/me';

describe('supportedAppPersonas', () => {
  it('keeps client, agent, and business', () => {
    expect(supportedAppPersonas(['business', 'agent', 'client'])).toEqual(['client', 'agent', 'business']);
  });

  it('filters unknown personas', () => {
    expect(supportedAppPersonas(['client', 'unknown' as 'client'])).toEqual(['client']);
  });
});

describe('orderedSupportedAppPersonas', () => {
  it('orders client then agent then business', () => {
    expect(orderedSupportedAppPersonas(['business', 'agent', 'client'])).toEqual([
      'client',
      'agent',
      'business',
    ]);
  });
});

describe('derivePersonasFromMeUser', () => {
  it('uses personas array from API when present', () => {
    const u: MeUser = {
      id: '1',
      personas: ['business', 'agent'],
    };
    expect(derivePersonasFromMeUser(u)).toEqual(['business', 'agent']);
  });

  it('derives from relations when personas missing', () => {
    const u: MeUser = {
      id: '1',
      client: {},
      agent: {},
    };
    expect(derivePersonasFromMeUser(u)).toEqual(['client', 'agent']);
  });
});
