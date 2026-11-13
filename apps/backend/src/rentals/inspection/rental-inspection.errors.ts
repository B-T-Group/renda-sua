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

export function acceptStartNotEnrolled(): HttpException {
  return new HttpException(
    {
      success: false,
      code: 'RENTAL_ACCEPT_START_NOT_ENROLLED',
      error: 'This booking uses the start PIN.',
      message: 'This booking uses the start PIN.',
    },
    HttpStatus.BAD_REQUEST
  );
}

export function acceptStartConflict(message = 'That report changed. Review it again.'): HttpException {
  return new HttpException(
    {
      success: false,
      code: 'RENTAL_ACCEPT_START_CONFLICT',
      error: message,
      message,
    },
    HttpStatus.CONFLICT
  );
}

export function inspectionRejected(
  code: string,
  message: string,
  extra?: object
): HttpException {
  return new HttpException(
    { success: false, code, error: message, message, ...(extra ?? {}) },
    HttpStatus.BAD_REQUEST
  );
}

/** Mirrors rental_apply_inspection_decision: damage_upheld needs p_damage > 0. */
export function requireInspectionDamageAmount(
  outcome: string,
  damageAmount?: number | null
): number | null {
  if (outcome !== 'damage_upheld') return null;
  if (damageAmount == null || !Number.isFinite(Number(damageAmount)) || Number(damageAmount) <= 0) {
    throw inspectionRejected(
      'RENTAL_INSPECTION_DAMAGE_AMOUNT',
      'Upholding damage requires a positive damage amount'
    );
  }
  return Number(damageAmount);
}
