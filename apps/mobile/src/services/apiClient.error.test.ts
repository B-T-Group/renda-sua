import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/auth0', () => ({
  getEnv: () => ({ apiUrl: 'https://dev.api.rendasua.com/api' }),
}));

vi.mock('./auth0DirectService', () => ({
  default: {
    getAccessToken: vi.fn().mockResolvedValue('token'),
    refreshAccessTokenDetailed: vi.fn(),
  },
}));

vi.mock('../utils/activePersonaStorage', () => ({
  buildActivePersonaHeaders: vi.fn().mockResolvedValue({}),
}));

import { apiRequest } from './apiClient';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 400 ? 'Bad Request' : 'OK',
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('apiRequest error codes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the MoMo phone-gate code off the human message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          success: false,
          error: 'MOBILE_MONEY_PHONE_UNCONFIRMED',
          message:
            'Confirm that your mobile money number can receive payments before accepting this order.',
        })
      )
    );

    await expect(apiRequest('/orders/confirm', { method: 'POST' })).rejects.toMatchObject({
      code: 'MOBILE_MONEY_PHONE_UNCONFIRMED',
      status: 400,
      message:
        'Confirm that your mobile money number can receive payments before accepting this order.',
    });
  });

  it('does not treat Nest HTTP status text as a business code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, { error: 'Bad Request', message: 'validation failed' })
      )
    );

    await expect(apiRequest('/orders/confirm', { method: 'POST' })).rejects.toMatchObject({
      message: 'validation failed',
      status: 400,
      code: undefined,
    });
  });

  it('does not invent a code from an empty error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(400, ''))
    );

    await expect(apiRequest('/orders/confirm', { method: 'POST' })).rejects.toMatchObject({
      message: 'API 400: Bad Request',
      code: undefined,
    });
  });
});
