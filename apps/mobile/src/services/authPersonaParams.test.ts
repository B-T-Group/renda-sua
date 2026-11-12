import { describe, expect, it } from 'vitest';
import { authorizeAdditionalParameters, tokenRequestBody } from './authPersonaParams';

describe('authorize additional parameters', () => {
  it('includes active_persona for the Auth0 authorize query', () => {
    expect(authorizeAdditionalParameters('https://api.example', 'business')).toEqual({
      audience: 'https://api.example',
      active_persona: 'business',
    });
  });

  it('omits active_persona when none is stored', () => {
    expect(authorizeAdditionalParameters('https://api.example')).toEqual({
      audience: 'https://api.example',
    });
  });
});

describe('token request body', () => {
  const grant = {
    grant_type: 'password',
    username: 'oru@rendasua-test.com',
    client_id: 'client',
  };

  it('includes active_persona on the token request', () => {
    expect(tokenRequestBody(grant, 'client')).toEqual({
      ...grant,
      active_persona: 'client',
    });
  });

  it('leaves the token request unchanged when persona is absent', () => {
    expect(tokenRequestBody(grant)).toEqual(grant);
  });
});
