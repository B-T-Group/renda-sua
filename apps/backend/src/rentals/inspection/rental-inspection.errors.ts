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

export function inspectionStaleReport(): HttpException {
  return new HttpException('That report changed. Review it again.', HttpStatus.CONFLICT);
}

/** Hasura unique (version_id, persona) or the correction SQL conflict. */
export function isInspectionAckConflict(error: unknown): boolean {
  const err = error as { response?: unknown; message?: unknown };
  const text = JSON.stringify(err?.response ?? err?.message ?? error ?? '').toLowerCase();
  return (
    text.includes('rental_inspection_correction_conflict') ||
    text.includes('rental_inspection_acks_version_id_persona_key') ||
    text.includes('uniqueness violation') ||
    text.includes('duplicate key')
  );
}
