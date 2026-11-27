import { HttpException, HttpStatus } from '@nestjs/common';

export const RETURN_REPORT_CODES = {
  NOT_OUT: 'RENTAL_RETURN_REPORT_NOT_OUT',
  NOT_STARTED: 'RENTAL_RETURN_REPORT_NOT_STARTED',
  ALREADY_CONFIRMED: 'RENTAL_RETURN_ALREADY_CONFIRMED',
  NOT_ESCALATED: 'RENTAL_RETURN_NOT_ESCALATED',
  DISABLED: 'RENTAL_RETURN_REPORT_DISABLED',
  NOT_RECEIVED_OPEN: 'RENTAL_RETURN_NOT_RECEIVED_OPEN',
} as const;

function conflict(code: string, message: string): HttpException {
  return new HttpException(
    { success: false, code, error: message, message },
    HttpStatus.CONFLICT
  );
}

export function returnReportNotOut(): HttpException {
  return conflict(
    RETURN_REPORT_CODES.NOT_OUT,
    'This rental is not out with the renter.'
  );
}

export function returnReportNotStarted(): HttpException {
  return conflict(
    RETURN_REPORT_CODES.NOT_STARTED,
    'This rental has not started.'
  );
}

export function returnAlreadyConfirmed(): HttpException {
  return conflict(
    RETURN_REPORT_CODES.ALREADY_CONFIRMED,
    'The business already confirmed this return.'
  );
}

export function returnNotEscalated(): HttpException {
  return conflict(
    RETURN_REPORT_CODES.NOT_ESCALATED,
    'Support can confirm only after the return report is escalated.'
  );
}

/** A "didn't receive the item" report is open: support handles it, not a return. */
export function returnReportNotReceivedOpen(): HttpException {
  return conflict(
    RETURN_REPORT_CODES.NOT_RECEIVED_OPEN,
    'This rental has a missing-item report. Support will follow up.'
  );
}

export function returnReportDisabled(): HttpException {
  return new HttpException(
    {
      success: false,
      code: RETURN_REPORT_CODES.DISABLED,
      error: 'Not found',
      message: 'Not found',
    },
    HttpStatus.NOT_FOUND
  );
}
