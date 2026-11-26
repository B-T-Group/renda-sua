import { cardHoldLines, depositInputError, depositHourRate, depositOnSave, holdPresentation, showsCardDeposit, showsListingDeposit } from './cardDeposit';

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
    expect(holdPresentation({ total: 180, deposit: 180, authorized: 180 })).toEqual({ mode: 'sentence', amount: 180 });
    expect(holdPresentation({ total: 160, deposit: 20, authorized: 180 })).toEqual({ mode: 'split', total: 160, deposit: 20 });
    expect(holdPresentation({ total: 45000, deposit: 0, authorized: 0 })).toEqual({ mode: 'total', amount: 45000 });
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

  it('uses one default-deposit rule with the server: 8 × hourly, or ⅔ of the day price without hourly', () => {
    expect(depositOnSave('CAD', '', 40, { daily: 300 })).toBe(320);
    expect(depositOnSave('CAD', '', 40, { daily: 300, offersHourly: true })).toBe(320);
    expect(depositOnSave('CAD', '', 40, { daily: 300, offersHourly: false })).toBe(200);
    expect(depositOnSave('CAD', '', 0, { daily: 300 })).toBe(200);
    expect(depositOnSave('CAD', '', Number.NaN, { daily: 300, offersHourly: false })).toBe(200);
    expect(depositOnSave('XAF', '', 3000, { daily: 27000, offersHourly: false })).toBeUndefined();
    expect(depositOnSave('CAD', '75', 40, { daily: 300, offersHourly: false })).toBe(75);
    expect(depositHourRate(0, {})).toBe(0);
  });

  it('does not default a card deposit from a negative rate or a stale hourly price', () => {
    expect(depositHourRate(-40, {})).toBe(0);
    expect(depositHourRate(40, { offersHourly: false })).toBe(0);
    expect(depositHourRate(-40, { daily: 240 })).toBe(20);
    expect(depositHourRate(Number.NaN, {})).toBeNaN();
    expect(depositOnSave('CAD', '', -40)).toBe(0);
    expect(depositOnSave('CAD', '', 40, { offersHourly: false })).toBe(0);
    expect(depositOnSave('CAD', '', -40, { daily: 240 })).toBe(160);
    expect(depositOnSave('CAD', '', Number.NaN)).toBeUndefined();
    expect(depositOnSave('CAD', '', Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});
