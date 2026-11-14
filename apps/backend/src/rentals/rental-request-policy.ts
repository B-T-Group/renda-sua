import { HttpException, HttpStatus, ParseUUIDPipe } from '@nestjs/common';

export const REQUEST_POLICY_NOT_FOUND = { message: 'Not found' };

export function requestPolicyNotFound(): HttpException {
  return new HttpException(REQUEST_POLICY_NOT_FOUND, HttpStatus.NOT_FOUND);
}

export const requestPolicyIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => requestPolicyNotFound(),
});

const REQUEST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRequestUuid(value: string): boolean {
  return REQUEST_UUID.test(value);
}
