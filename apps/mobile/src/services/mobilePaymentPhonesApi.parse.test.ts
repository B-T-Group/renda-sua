import { describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import { parseE164Parts } from './mobilePaymentPhonesApi';

describe('parseE164Parts', () => {
  it('keeps Togo on 228 and does not let a later 228 steal 237 or 241', () => {
    expect(parseE164Parts('+228 90 11 22 33')).toEqual({
      countryCode: '228',
      phoneNumber: '90112233',
    });
    expect(parseE164Parts('+237228000111')).toEqual({
      countryCode: '237',
      phoneNumber: '228000111',
    });
    expect(parseE164Parts('+24122800011')).toEqual({
      countryCode: '241',
      phoneNumber: '22800011',
    });
  });

  it('falls back to 237 only when the digits do not start with a MoMo code', () => {
    expect(parseE164Parts('+33612345678')).toEqual({
      countryCode: '237',
      phoneNumber: '33612345678',
    });
  });
});
