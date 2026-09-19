import {
  isHttpsRequest,
  sessionClearCookieOptions,
  sessionCookieOptions,
} from './session-cookie';

describe('sessionCookieOptions', () => {
  it('keeps Lax on plain HTTP so a local API can set the cookie', () => {
    expect(isHttpsRequest({ headers: {} })).toBe(false);
    expect(sessionCookieOptions({ headers: {} })).toEqual(
      expect.objectContaining({ sameSite: 'lax', secure: false, httpOnly: true })
    );
  });

  it('uses None and Secure behind HTTPS so localhost can send the cookie', () => {
    const req = { headers: { 'x-forwarded-proto': 'https, http' } };
    expect(isHttpsRequest(req)).toBe(true);
    expect(sessionCookieOptions(req)).toEqual(
      expect.objectContaining({ sameSite: 'none', secure: true })
    );
    expect(sessionClearCookieOptions(req)).not.toHaveProperty('maxAge');
  });
});
