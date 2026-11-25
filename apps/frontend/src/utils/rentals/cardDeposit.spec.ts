import { cardHoldLines, depositInputError, depositOnSave, showsCardDeposit, showsListingDeposit } from './cardDeposit';

describe('card deposit field', () => {
  it('hides a deposit that is the whole card hold', () => {
    expect(cardHoldLines({ total: 180, deposit: 180, authorized: 180 })).toEqual({
      showDeposit: false,
      additive: false,
    });
    expect(cardHoldLines({ total: 160, deposit: 20, authorized: 180 })).toEqual({
      showDeposit: true,
      additive: true,
    });
  });

  it('hides the field for XAF and XOF and keeps it for card currencies', () => {
    expect(showsCardDeposit('XAF')).toBe(false);
    expect(showsCardDeposit(' xof ')).toBe(false);
    expect(showsCardDeposit('CAD')).toBe(true);
    expect(showsCardDeposit('')).toBe(true);
  });

  it('does not invent 8x hourly when an XAF or XOF deposit is empty', () => {
    expect(depositOnSave('XAF', '', 40)).toBeUndefined();
    expect(depositOnSave('XOF', '  ', 40)).toBeUndefined();
    expect(depositOnSave('XAF', '0', 40)).toBe(0);
    expect(depositOnSave('CAD', '', 40)).toBe(320);
    expect(depositInputError('CAD', '1.2.3')).toBe(true);
    expect(depositInputError('CAD', '')).toBe(false);
    expect(showsListingDeposit('')).toBe(false);
    expect(showsListingDeposit('CAD')).toBe(true);
  });

  it('keeps a typed amount and does not store a negative mobile-money deposit', () => {
    expect(depositOnSave('XAF', '-1', 40)).toBeUndefined();
    expect(depositOnSave('XOF', '-0.01', 40)).toBeUndefined();
    expect(depositOnSave('XAF', '12.5', 40)).toBe(12.5);
    expect(depositOnSave('CAD', '12.5', 40)).toBe(12.5);
    expect(depositOnSave('CAD', '0', 40)).toBe(0);
    expect(depositOnSave('CAD', '', 10.126)).toBe(81.01);
    expect(depositOnSave('CAD', '', Number.NaN)).toBeUndefined();
    expect(depositOnSave('CAD', '', Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(depositInputError('CAD', '-0.01')).toBe(true);
    expect(depositInputError('CAD', '0')).toBe(false);
    expect(depositInputError('XOF', '-5')).toBe(false);
    expect(showsListingDeposit(' xaf ')).toBe(false);
  });
});
