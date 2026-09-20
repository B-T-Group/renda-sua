import type { CookieOptions } from 'express';

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type CookieRequest = {
  secure?: boolean;
  headers?: object;
};

function forwardedProto(headers: object | undefined): string | undefined {
  if (!headers) return undefined;
  const value = (headers as Record<string, string | string[] | undefined>)[
    'x-forwarded-proto'
  ];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(',')[0]?.trim();
}

export function isHttpsRequest(req: CookieRequest): boolean {
  if (req.secure) return true;
  return forwardedProto(req.headers) === 'https';
}

/** HTTPS APIs use None+Secure so localhost can send the cookie cross-site. */
export function sessionCookieOptions(req: CookieRequest): CookieOptions {
  const secure = isHttpsRequest(req);
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  };
}

export function sessionClearCookieOptions(req: CookieRequest): CookieOptions {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions(req);
  return options;
}
