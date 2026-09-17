import { MERCHANT_AGREEMENT_VERSION } from './merchant-agreement.constants';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('merchant agreement version', () => {
  it('is bumped for auto-sponsored reels', () => {
    expect(MERCHANT_AGREEMENT_VERSION).toBe('2026-09-2');
  });

  it('documents platform auto-generated reels in en and fr', () => {
    const dir = __dirname;
    const en = readFileSync(
      join(dir, 'merchant-partnership-agreement-v2.en.html'),
      'utf8'
    );
    const fr = readFileSync(
      join(dir, 'merchant-partnership-agreement-v2.fr.html'),
      'utf8'
    );
    expect(en).toContain('automatically generate promotional reels');
    expect(en).toContain('do not consume the Merchant');
    expect(fr).toContain('générer automatiquement des reels promotionnels');
    expect(fr).toContain('ne consomment pas les jetons');
  });
});
