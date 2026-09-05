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

/** JWT `x-hasura-user-id` must be the DB users.id UUID, not an Auth0 `sub`. */
export function requireAuthUserUuid(value?: string | null): string {
  const trimmed = value?.trim();
  if (!isUuid(trimmed)) {
    throw new UnauthorizedException(
      'Invalid authentication token: user id is not a UUID'
    );
  }
  return trimmed;
}
