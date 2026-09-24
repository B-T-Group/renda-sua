import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/auth0', () => ({
  getEnv: () => ({ apiUrl: 'https://dev.api.rendasua.com/api' }),
}));

import { publicApiGet, publicApiPost } from './publicApiClient';

describe('publicApiClient platform header', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('publicApiGet sends X-Client-Platform: mobile', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      statusText: 'OK',
      text: async () => JSON.stringify({ taken: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await publicApiGet('/auth/email-availability', { email: 'a@b.com' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      'X-Client-Platform': 'mobile',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  });

  it('publicApiPost sends X-Client-Platform: mobile and merges caller headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      statusText: 'OK',
      text: async () => JSON.stringify({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await publicApiPost('/auth/signup/start', { email: 'a@b.com' }, {
      headers: { 'x-rendasua-platform': 'ios' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      'X-Client-Platform': 'mobile',
      'x-rendasua-platform': 'ios',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  });

  it('caller headers take precedence over defaults', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      statusText: 'OK',
      text: async () => '{}',
    });
    vi.stubGlobal('fetch', fetchMock);

    await publicApiPost('/auth/signup/resend-otp', { attemptId: '1' }, {
      headers: { 'X-Client-Platform': 'android' },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Client-Platform']).toBe(
      'android'
    );
  });
});
