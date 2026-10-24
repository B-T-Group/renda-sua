import {
  businessDisplayWithMaskedOwner,
  maskPersonName,
} from './mask-name.util';

describe('maskPersonName', () => {
  it('keeps first name and last initial only', () => {
    expect(maskPersonName('Samuel', 'Besong')).toBe('Samuel B.');
  });
  it('handles missing parts', () => {
    expect(maskPersonName('Samuel', '')).toBe('Samuel');
    expect(maskPersonName('', 'Besong')).toBe('B.');
    expect(maskPersonName(null, undefined)).toBe('');
  });
  it('trims and uppercases the initial, unicode-safe', () => {
    expect(maskPersonName('  Ana ', ' élodie ')).toBe('Ana É.');
    expect(maskPersonName('Li', '𝒵hang')).toBe('Li 𝒵.');
  });
  it('never contains the full last name', () => {
    expect(maskPersonName('Jane', 'Doe-Smith')).not.toContain('Doe');
  });
});

describe('businessDisplayWithMaskedOwner', () => {
  it('appends masked owner', () => {
    expect(businessDisplayWithMaskedOwner('Renda Shop', 'Samuel', 'Besong')).toBe(
      'Renda Shop (Samuel B.)'
    );
  });
  it('falls back gracefully', () => {
    expect(businessDisplayWithMaskedOwner('Renda Shop', '', '')).toBe('Renda Shop');
    expect(businessDisplayWithMaskedOwner('', 'Samuel', 'Besong')).toBe('Samuel B.');
  });
});
