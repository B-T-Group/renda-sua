import { HttpException, HttpStatus } from '@nestjs/common';

export const NOT_RECEIVED_CODES = {
  NOT_INSPECTED: 'RENTAL_NOT_RECEIVED_NOT_INSPECTED',
  WINDOW_CLOSED: 'RENTAL_NOT_RECEIVED_WINDOW_CLOSED',
  RETURN_REPORTED: 'RENTAL_NOT_RECEIVED_RETURN_REPORTED',
} as const;

function conflict(code: string, message: string): HttpException {
  return new HttpException(
    { success: false, code, error: message, message },
    HttpStatus.CONFLICT
  );
}

export function notReceivedNotInspected(): HttpException {
  return conflict(
    NOT_RECEIVED_CODES.NOT_INSPECTED,
    'This booking has no condition report.'
  );
}

export function notReceivedWindowClosed(): HttpException {
  return conflict(
    NOT_RECEIVED_CODES.WINDOW_CLOSED,
    'The 30-minute window to report a missing item has closed.'
  );
}

export function notReceivedReturnReported(): HttpException {
  return conflict(
    NOT_RECEIVED_CODES.RETURN_REPORTED,
    'You already reported returning this item.'
  );
}
