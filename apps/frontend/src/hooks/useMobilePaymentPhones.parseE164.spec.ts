import { parseE164Parts } from './useMobilePaymentPhones';

describe('parseE164Parts', () => {
  it('splits Cameroon, Gabon, and Togo E.164 numbers', () => {
    expect(parseE164Parts('+237670000000')).toEqual({
      countryCode: '237',
      phoneNumber: '670000000',
    });
    expect(parseE164Parts('+24106123456')).toEqual({
      countryCode: '241',
      phoneNumber: '06123456',
    });
    expect(parseE164Parts('+22890123456')).toEqual({
      countryCode: '228',
      phoneNumber: '90123456',
    });
  });

  it('does not treat a later 228 as Togo', () => {
    expect(parseE164Parts('+237228999999')).toEqual({
      countryCode: '237',
      phoneNumber: '228999999',
    });
  });
});
