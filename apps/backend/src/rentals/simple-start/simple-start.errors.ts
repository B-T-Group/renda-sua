import { HttpException, HttpStatus } from '@nestjs/common';
import { PIN_RETIRED_MESSAGE, START_WINDOW_CODE, type StartWindowState } from './simple-start.policy';

export function pinRetired(): HttpException {
  return new HttpException(PIN_RETIRED_MESSAGE, HttpStatus.CONFLICT);
}

export function startWindowClosed(opensAt: Date, state: StartWindowState): HttpException {
  const early = state === 'before';
  const message = early
    ? 'You can start this rental from the pickup day.'
    : 'This rental has ended.';
  return new HttpException(
    {
      success: false,
      code: START_WINDOW_CODE,
      message,
      error: message,
      start_opens_at: Number.isNaN(opensAt.getTime()) ? null : opensAt.toISOString(),
    },
    HttpStatus.CONFLICT
  );
}
