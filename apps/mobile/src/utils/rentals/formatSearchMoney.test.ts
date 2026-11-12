import { formatSearchMoney } from './rentalRequestDisplay';

const NARROW = '\u202f';

describe('formatSearchMoney', () => {
  it('keeps the code in front for English and uses a narrow space before FCFA in French', () => {
    expect(formatSearchMoney(800, 'XAF', 'en')).toBe('FCFA 800');
    expect(formatSearchMoney(1140, 'XAF', 'en')).toBe('FCFA 1,140');
    expect(formatSearchMoney(800, 'XAF', 'fr')).toBe(`800${NARROW}FCFA`);
    expect(formatSearchMoney(1140, 'FCFA', 'fr')).toBe(`1${NARROW}140${NARROW}FCFA`);
  });
});
