import type { CookieOptions } from 'express';
import {
  isCorsOriginAllowed,
  parseCorsOrigins,
} from '../config/cors-origin';

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type CookieRequest = {
  secure?: boolean;
  headers?: object;
};

function firstHeader(
  value: string | string[] | undefined
): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(',')[0]?.trim();
}

function forwardedProto(headers: object | undefined): string | undefined {
  if (!headers) return undefined;
  const record = headers as Record<string, string | string[] | undefined>;
  return firstHeader(record['x-forwarded-proto']);
}

function requestOriginUrl(req: CookieRequest): string | undefined {
  const record = (req.headers ?? {}) as Record<
    string,
    string | string[] | undefined
  >;
  return firstHeader(record.origin) ?? firstHeader(record.referer);
}

function hostnameFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function matchesCookieSite(hostname: string, site: string): boolean {
  return hostname === site || hostname.endsWith(`.${site}`);
}

function cookieSite(): string {
  return process.env.SESSION_COOKIE_SITE || 'rendasua.com';
}

function isAllowlistedCrossSiteOrigin(originUrl: string): boolean {
  const allowlist = parseCorsOrigins(process.env.CORS_ORIGIN);
  try {
    const origin = new URL(originUrl).origin;
    return isCorsOriginAllowed(origin, allowlist);
  } catch {
    return false;
  }
}

export function isHttpsRequest(req: CookieRequest): boolean {
  if (req.secure) return true;
  return forwardedProto(req.headers) === 'https';
}

function resolveSameSite(req: CookieRequest): 'lax' | 'none' {
  if (!isHttpsRequest(req)) {
    return 'lax';
  }
  const originUrl = requestOriginUrl(req);
  if (!originUrl) {
    return 'lax';
  }
  const hostname = hostnameFromUrl(originUrl);
  if (!hostname) {
    return 'lax';
  }
  if (matchesCookieSite(hostname, cookieSite())) {
    return 'lax';
  }
  if (isAllowlistedCrossSiteOrigin(originUrl)) {
    return 'none';
  }
  return 'lax';
}

export function sessionCookieOptions(req: CookieRequest): CookieOptions {
  const secure = isHttpsRequest(req);
  const sameSite = resolveSameSite(req);
  return {
    httpOnly: true,
    secure: sameSite === 'none' ? true : secure,
    sameSite,
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  };
}

export function sessionClearCookieOptions(req: CookieRequest): CookieOptions {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions(req);
  return options;
}
