import { HttpException, HttpStatus } from '@nestjs/common';

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
