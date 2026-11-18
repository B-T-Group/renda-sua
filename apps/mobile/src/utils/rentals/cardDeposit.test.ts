import { depositOnSave, showsCardDeposit } from './cardDeposit';

describe('card deposit field', () => {
  it('hides the field for XAF and XOF and keeps it for card currencies', () => {
    expect(showsCardDeposit('XAF')).toBe(false);
    expect(showsCardDeposit(' xof ')).toBe(false);
    expect(showsCardDeposit('CAD')).toBe(true);
  });

  it('does not invent 8x hourly when an XAF or XOF deposit is empty', () => {
    expect(depositOnSave('XAF', '', 40)).toBeUndefined();
    expect(depositOnSave('XOF', '0', 40)).toBe(0);
    expect(depositOnSave('CAD', '', 40)).toBe(320);
  });
});