import { describe, expect, it } from 'vitest';
import { extractAuth0TokensFromLoginResponse } from './rendasuaLoginOtpService';

describe('extractAuth0TokensFromLoginResponse', () => {
  it('reads tokens at root', () => {
    const t = extractAuth0TokensFromLoginResponse({
      access_token: 'at',
      refresh_token: 'rt',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid',
    });
    expect(t?.access_token).toBe('at');
    expect(t?.refresh_token).toBe('rt');
  });

  it('finds tokens nested in data', () => {
    const t = extractAuth0TokensFromLoginResponse({
      success: true,
      data: {
        tokens: {
          access_token: 'nested',
          expires_in: '7200',
        },
      },
    });
    expect(t?.access_token).toBe('nested');
    expect(t?.expires_in).toBe(7200);
  });
});
