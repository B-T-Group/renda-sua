import { HttpException, HttpStatus } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export const ACCESS_TOKEN_REUSE_BUFFER_SEC = 60;

export function accessTokenTtlSec(token?: string): number | null {
  if (!token) return null;
  const payload = jwt.decode(token) as { exp?: number } | null;
  if (!payload?.exp) return null;
  return payload.exp - Math.floor(Date.now() / 1000);
}

export function canReuseAccessToken(token?: string): boolean {
  const ttl = accessTokenTtlSec(token);
  return ttl != null && ttl > ACCESS_TOKEN_REUSE_BUFFER_SEC;
}

export function requireRefreshToken(token?: string): string {
  if (!token) {
    throw new HttpException(
      { success: false, error: 'Auth0 did not return a refresh token' },
      HttpStatus.BAD_GATEWAY
    );
  }
  return token;
}

export function auth0ErrorCode(error: unknown): string | undefined {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (body && typeof body === 'object' && 'code' in body) {
      const code = (body as { code?: unknown }).code;
      return typeof code === 'string' ? code : undefined;
    }
  }
  const axiosData = (error as { response?: { data?: { error?: unknown } } })
    ?.response?.data;
  return typeof axiosData?.error === 'string' ? axiosData.error : undefined;
}

export function isInvalidGrantError(error: unknown): boolean {
  return auth0ErrorCode(error) === 'invalid_grant';
}
