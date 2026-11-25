import { isPriceChangeUnseenError } from './priceChangeUnseen';

describe('isPriceChangeUnseenError', () => {
  it('matches the 409 body from axios', () => {
    expect(
      isPriceChangeUnseenError({
        response: { status: 409, data: { statusCode: 409, message: 'PRICE_CHANGE_UNSEEN' } },
      })
    ).toBe(true);
    expect(isPriceChangeUnseenError({ response: { data: { code: 'PRICE_CHANGE_UNSEEN' } } })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isPriceChangeUnseenError({ response: { status: 410, data: { message: 'Contract has expired' } } })).toBe(false);
    expect(isPriceChangeUnseenError(new Error('PRICE_CHANGE_UNSEEN'))).toBe(false);
    expect(isPriceChangeUnseenError(null)).toBe(false);
  });
});
