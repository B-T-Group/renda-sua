import { HttpException, HttpStatus } from '@nestjs/common';
import { INSPECTION_CODES } from './rental-inspection.policy';

export function inspectionUpdateRequired(): HttpException {
  return new HttpException(
    {
      success: false,
      code: INSPECTION_CODES.UPDATE_REQUIRED,
      error: 'Update required',
      message:
        'Update required. This rental uses condition inspections. Update the app to review the report and continue.',
    },
    426
  );
}

export function inspectionUnavailable(): HttpException {
  return new HttpException(
    {
      success: false,
      code: 'RENTAL_INSPECTION_UNAVAILABLE',
      error: 'Inspection state unavailable',
      message: 'Inspection state unavailable. Try again.',
    },
    HttpStatus.SERVICE_UNAVAILABLE
  );
}

export function inspectionRejected(code: string, message: string): HttpException {
  return new HttpException(
    { success: false, code, error: message, message },
    HttpStatus.BAD_REQUEST
  );
}
