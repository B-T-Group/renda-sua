import { readFileSync } from 'fs';
import { join } from 'path';
import {
  businessDisplayWithMaskedOwner,
  maskPersonName,
  PUBLIC_REFERRAL_LOOKUP_THROTTLE,
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

describe('PUBLIC_REFERRAL_LOOKUP_THROTTLE', () => {
  it('caps unauthenticated referral lookups at 20 per minute', () => {
    expect(PUBLIC_REFERRAL_LOOKUP_THROTTLE).toEqual({
      short: { limit: 20, ttl: 60000 },
    });
  });

  it.each([
    ['../../users/users.controller.ts', "@Get('public/by-referral-code/:code')"],
    ['../../agents/agents.controller.ts', "@Get('public/by-code/:agentCode')"],
    ['../../businesses/businesses.controller.ts', "@Get('public/by-code/:businessCode')"],
  ])('applies that cap on %s', (file, route) => {
    const src = readFileSync(join(__dirname, file), 'utf8');
    const at = src.indexOf(route);
    const block = src.slice(Math.max(0, at - 180), at);
    expect(block).toContain('@Public()');
    expect(block).toContain('@Throttle(PUBLIC_REFERRAL_LOOKUP_THROTTLE)');
  });
});
