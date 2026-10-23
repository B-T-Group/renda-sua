import { describe, expect, it } from 'vitest';
import { errorOutcomeFromThrown } from './checkoutErrorOutcome';

describe('errorOutcomeFromThrown', () => {
  it('keeps a string API error code', () => {
    const e = Object.assign(new Error('No coverage'), { code: 'DELIVERY_UNAVAILABLE' });
    expect(errorOutcomeFromThrown(e)).toEqual({
      type: 'error',
      message: 'No coverage',
      code: 'DELIVERY_UNAVAILABLE',
    });
  });

  it('omits non-string or empty codes', () => {
    expect(errorOutcomeFromThrown(Object.assign(new Error('x'), { code: 400 }))).toEqual({ type: 'error', message: 'x' });
    expect(errorOutcomeFromThrown(Object.assign(new Error('y'), { code: '' }))).toEqual({ type: 'error', message: 'y' });
  });

  it('falls back to a generic message for non-Error throws', () => {
    expect(errorOutcomeFromThrown(null)).toEqual({ type: 'error', message: 'Failed to place order.' });
  });
});
