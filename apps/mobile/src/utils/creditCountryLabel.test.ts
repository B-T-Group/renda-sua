import { describe, expect, it } from 'vitest';
import {
  creditCountryLabel,
  creditCountryLabelParts,
} from './creditCountryLabel';

describe('creditCountryLabelParts', () => {
  it('uses the known label for a listed market', () => {
    expect(creditCountryLabelParts('PH')).toEqual({
      key: 'admin.credits.countries.PH',
      fallback: 'Philippines',
    });
    expect(creditCountryLabelParts('CI').fallback).toBe("Côte d'Ivoire");
  });

  it('keeps an unknown market renderable', () => {
    expect(creditCountryLabelParts('ZZ')).toEqual({
      key: 'admin.credits.countries.ZZ',
      fallback: 'ZZ',
    });
    const t = (key: string, fallback: string) => `${key}|${fallback}`;
    expect(creditCountryLabel('ZZ', t)).toBe('admin.credits.countries.ZZ|ZZ');
  });
});
