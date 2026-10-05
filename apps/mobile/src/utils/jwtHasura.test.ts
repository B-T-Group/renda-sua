import { describe, expect, it } from 'vitest';
import {
  businessHasuraRoleHeaders,
  decodeHasuraAllowedRoles,
  tokenAllowsHasuraRole,
} from './jwtHasura';

function token(payload: object): string {
  const segment = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `hdr.${segment}.sig`;
}

describe('jwtHasura', () => {
  it('reads allowed Hasura roles from an array or a JSON string', () => {
    const withArray = token({
      'https://hasura.io/jwt/claims': {
        'x-hasura-allowed-roles': ['client', 'business'],
      },
    });
    const withString = token({
      'https://hasura.io/jwt/claims': {
        'x-hasura-allowed-roles': '["business"]',
      },
    });
    expect(decodeHasuraAllowedRoles(withArray)).toEqual(['client', 'business']);
    expect(tokenAllowsHasuraRole(withString, 'business')).toBe(true);
    expect(tokenAllowsHasuraRole(withArray, 'agent')).toBe(false);
  });

  it('sends the business role header only for an allowed business session', () => {
    const tokenValue = token({
      'https://hasura.io/jwt/claims': {
        'x-hasura-allowed-roles': ['client', 'business'],
      },
    });
    expect(businessHasuraRoleHeaders(tokenValue, 'business')).toEqual({
      'x-hasura-role': 'business',
    });
    expect(businessHasuraRoleHeaders(tokenValue, 'client')).toEqual({});
    expect(businessHasuraRoleHeaders(null, 'business')).toEqual({});
    expect(
      businessHasuraRoleHeaders(
        token({
          'https://hasura.io/jwt/claims': { 'x-hasura-allowed-roles': ['client'] },
        }),
        'business'
      )
    ).toEqual({});
  });
});
