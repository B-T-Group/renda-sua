import { describe, expect, it } from 'vitest';
import { findCountryCode } from './addressRegionMatch';

describe('findCountryCode', () => {
  it('resolves DRC labels to CD and keeps Congo-Brazzaville as CG', async () => {
    await expect(findCountryCode('DR Congo')).resolves.toBe('CD');
    await expect(findCountryCode('RDC Congo')).resolves.toBe('CD');
    await expect(findCountryCode('République démocratique du Congo')).resolves.toBe('CD');
    await expect(findCountryCode('Congo')).resolves.toBe('CG');
    await expect(findCountryCode('Congo-Brazzaville')).resolves.toBe('CG');
  });

  it('still accepts an ISO code the alias map does not list', async () => {
    await expect(findCountryCode('CD')).resolves.toBe('CD');
    await expect(findCountryCode('')).resolves.toBe('');
  });
});
