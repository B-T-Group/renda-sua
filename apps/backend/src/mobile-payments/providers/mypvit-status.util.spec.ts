import {
  buildMypvitStatusPath,
  isNotFoundHttpError,
  resolveMypvitOperator,
} from './mypvit-status.util';

describe('resolveMypvitOperator', () => {
  it('classifies Gabon MOOV E.164 numbers that previously defaulted to Airtel', () => {
    expect(resolveMypvitOperator('+24166123456')).toBe('moov');
    expect(resolveMypvitOperator('+24162123456')).toBe('moov');
    expect(resolveMypvitOperator('+24165123456')).toBe('moov');
  });

  it('classifies Gabon Airtel E.164 numbers as airtel', () => {
    expect(resolveMypvitOperator('+24174123456')).toBe('airtel');
    expect(resolveMypvitOperator('+24177123456')).toBe('airtel');
  });

  it('classifies national MOOV digits (with or without leading zero)', () => {
    expect(resolveMypvitOperator('066123456')).toBe('moov');
    expect(resolveMypvitOperator('66123456')).toBe('moov');
  });

  it('defaults to airtel when the phone is missing or unknown', () => {
    expect(resolveMypvitOperator('')).toBe('airtel');
    expect(resolveMypvitOperator(undefined)).toBe('airtel');
    expect(resolveMypvitOperator('+24161123456')).toBe('airtel');
  });
});

describe('buildMypvitStatusPath', () => {
  it('uses the original path-style Status API', () => {
    expect(buildMypvitStatusPath('STATUSCODE1', 'PAYTEST001')).toBe(
      '/STATUSCODE1/status/PAYTEST001'
    );
  });
});

describe('isNotFoundHttpError', () => {
  it('is true only for HTTP 404 responses', () => {
    expect(isNotFoundHttpError({ response: { status: 404 } })).toBe(true);
    expect(isNotFoundHttpError({ response: { status: 500 } })).toBe(false);
    expect(isNotFoundHttpError({})).toBe(false);
  });
});
