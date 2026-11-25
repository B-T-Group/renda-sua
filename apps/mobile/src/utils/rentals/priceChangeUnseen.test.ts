import { isPriceChangeUnseenError } from './priceChangeUnseen';

describe('isPriceChangeUnseenError', () => {
  it('matches the 409 body from the API client', () => {
    const err = Object.assign(new Error('PRICE_CHANGE_UNSEEN'), {
      status: 409,
      data: { statusCode: 409, message: 'PRICE_CHANGE_UNSEEN' },
    });
    expect(isPriceChangeUnseenError(err)).toBe(true);
    expect(isPriceChangeUnseenError({ code: 'PRICE_CHANGE_UNSEEN' })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isPriceChangeUnseenError(new Error('Contract has expired'))).toBe(false);
    expect(isPriceChangeUnseenError(null)).toBe(false);
    expect(isPriceChangeUnseenError('PRICE_CHANGE_UNSEEN')).toBe(false);
  });
});
