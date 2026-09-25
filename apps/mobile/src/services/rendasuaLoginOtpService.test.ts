import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/auth0', () => ({
  getEnv: () => ({ apiUrl: 'https://dev.api.rendasua.com/api' }),
}));

const { finalizeAuthWithTokens } = vi.hoisted(() => ({
  finalizeAuthWithTokens: vi.fn(),
}));

vi.mock('./auth0DirectService', () => ({
  default: {
    finalizeAuthWithTokens,
  },
}));

import {
  extractAuth0TokensFromLoginResponse,
  fetchLoginOtpOptions,
  startLoginOtp,
  verifyLoginOtpEmail,
} from './rendasuaLoginOtpService';

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

describe('login OTP requests send X-Client-Platform', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    finalizeAuthWithTokens.mockReset();
  });

  function mockJsonResponse(body: unknown, ok = true) {
    return {
      ok,
      statusText: ok ? 'OK' : 'Bad Request',
      text: async () => JSON.stringify(body),
    };
  }

  it('otp-options, start-otp and verify-otp send X-Client-Platform: mobile', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          defaultChannel: 'email',
          availableChannels: ['email'],
        })
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          channel: 'email',
          defaultChannel: 'email',
          availableChannels: ['email'],
        })
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          access_token: 'at',
          refresh_token: 'rt-from-nest',
          expires_in: 3600,
        })
      );
    vi.stubGlobal('fetch', fetchMock);
    finalizeAuthWithTokens.mockResolvedValue({ type: 'success' });

    await fetchLoginOtpOptions({ email: 'user@rendasua-test.com' });
    await startLoginOtp({ email: 'user@rendasua-test.com' }, 'email');
    await verifyLoginOtpEmail('user@rendasua-test.com', '0000', 'email');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const call of fetchMock.mock.calls) {
      const [, init] = call as [string, RequestInit];
      expect(init.headers).toMatchObject({
        'X-Client-Platform': 'mobile',
        'Content-Type': 'application/json',
      });
    }

    expect(finalizeAuthWithTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: 'at',
        refresh_token: 'rt-from-nest',
      })
    );
  });
});
