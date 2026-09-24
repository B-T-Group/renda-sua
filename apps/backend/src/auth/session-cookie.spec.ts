import {
  isHttpsRequest,
  sessionClearCookieOptions,
  sessionCookieOptions,
} from './session-cookie';

describe('sessionCookieOptions', () => {
  const httpsProto = { 'x-forwarded-proto': 'https' };

  it('keeps Lax on plain HTTP so a local API can set the cookie', () => {
    expect(isHttpsRequest({ headers: {} })).toBe(false);
    expect(sessionCookieOptions({ headers: {} })).toEqual(
      expect.objectContaining({ sameSite: 'lax', secure: false, httpOnly: true })
    );
  });

  it('uses Lax for same-site rendasua.com origins over HTTPS', () => {
    const req = {
      headers: {
        ...httpsProto,
        origin: 'https://www.rendasua.com',
        host: 'api.rendasua.com',
      },
    };
    expect(sessionCookieOptions(req)).toEqual(
      expect.objectContaining({ sameSite: 'lax', secure: true })
    );
    expect(sessionClearCookieOptions(req)).not.toHaveProperty('maxAge');
  });

  it('uses Lax for dev.rendasua.com over HTTPS', () => {
    const req = {
      headers: {
        ...httpsProto,
        origin: 'https://dev.rendasua.com',
        host: 'api.dev.rendasua.com',
      },
    };
    expect(sessionCookieOptions(req)).toEqual(
      expect.objectContaining({ sameSite: 'lax', secure: true })
    );
  });

  it('uses None and Secure for allowlisted cross-site localhost over HTTPS', () => {
    const req = {
      headers: {
        ...httpsProto,
        origin: 'http://localhost:4200',
        host: 'api.rendasua.com',
      },
    };
    expect(isHttpsRequest(req)).toBe(true);
    expect(sessionCookieOptions(req)).toEqual(
      expect.objectContaining({ sameSite: 'none', secure: true })
    );
    expect(sessionClearCookieOptions(req)).not.toHaveProperty('maxAge');
  });
});
