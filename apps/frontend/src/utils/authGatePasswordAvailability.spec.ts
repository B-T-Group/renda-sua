import { probePasswordLoginEndpoint } from './authGatePasswordAvailability';

function client(post: jest.Mock) {
  return { post } as never;
}

describe('probePasswordLoginEndpoint', () => {
  it('treats 404 as password login not shipped', async () => {
    const post = jest.fn(async () => ({ status: 404 }));
    await expect(probePasswordLoginEndpoint(client(post))).resolves.toBe(false);
    expect(post).toHaveBeenCalledWith(
      '/auth/password-login',
      {},
      expect.objectContaining({
        headers: { 'X-Client-Platform': 'web' },
      })
    );
  });

  it('treats validation and auth failures as the endpoint existing', async () => {
    for (const status of [400, 401, 422]) {
      const post = jest.fn(async () => ({ status }));
      await expect(probePasswordLoginEndpoint(client(post))).resolves.toBe(true);
    }
  });

  it('hides password login only when a thrown error is 404', async () => {
    const missing = jest.fn(async () => {
      throw { response: { status: 404 } };
    });
    await expect(probePasswordLoginEndpoint(client(missing))).resolves.toBe(false);
    const outage = jest.fn(async () => {
      throw { response: { status: 503 } };
    });
    await expect(probePasswordLoginEndpoint(client(outage))).resolves.toBe(true);
  });
});
