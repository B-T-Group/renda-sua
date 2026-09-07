import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value?: string | null): value is string {
  return !!value?.trim() && UUID_RE.test(value.trim());
}

export function requireUuid(value: string | undefined, fieldName: string): string {
  const trimmed = value?.trim();
  if (!isUuid(trimmed)) {
    throw new HttpException(`${fieldName} must be a UUID`, HttpStatus.BAD_REQUEST);
  }
  return trimmed;
}

/**
 * JWT `x-hasura-user-id` must be the DB users.id UUID, not an Auth0 `sub`.
 * 
 * Common failure: Auth0 Action sets `x-hasura-user-id` to Auth0 `sub` (e.g.
 * `auth0|1234` or `email|abc`) instead of looking up the database user UUID.
 * 
 * Fix: Update Auth0 Action to call POST /api/auth0-actions/resolve-user-id
 * with { email } or { phone_number } to get the database user UUID, then set
 * that as `x-hasura-user-id` in the JWT claims.
 */
export function requireAuthUserUuid(value?: string | null): string {
  const trimmed = value?.trim();
  if (!isUuid(trimmed)) {
    const valueStr = trimmed || '';
    const prefix = valueStr.split('|')[0];
    let hint = '';
    if (prefix === 'auth0' || prefix === 'email' || prefix === 'sms') {
      hint = ` (Auth0 sub detected: ${prefix}|...). Auth0 Action must look up the database user UUID, not use the Auth0 sub.`;
    }
    throw new UnauthorizedException(
      `Invalid authentication token: user id is not a UUID${hint}`
    );
  }
  return trimmed;
}
