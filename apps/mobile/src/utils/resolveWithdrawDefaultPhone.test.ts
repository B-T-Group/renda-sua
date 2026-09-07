import { describe, expect, it } from 'vitest';
import { resolveWithdrawDefaultPhone } from './resolveWithdrawDefaultPhone';

describe('resolveWithdrawDefaultPhone', () => {
  it('uses location phone for a location wallet', () => {
    expect(
      resolveWithdrawDefaultPhone({
        isLocationAccount: true,
        locationPhone: '+237600000001',
        userPhone: '+237600000002',
        authPhone: '+237600000003',
      })
    ).toBe('+237600000001');
  });

  it('falls back to user then Auth0 when location phone is empty', () => {
    expect(
      resolveWithdrawDefaultPhone({
        isLocationAccount: true,
        locationPhone: '  ',
        userPhone: '+237600000002',
        authPhone: '+237600000003',
      })
    ).toBe('+237600000002');
    expect(
      resolveWithdrawDefaultPhone({
        isLocationAccount: true,
        userPhone: '',
        authPhone: '+237600000003',
      })
    ).toBe('+237600000003');
  });

  it('uses users.phone_number for a personal wallet', () => {
    expect(
      resolveWithdrawDefaultPhone({
        isLocationAccount: false,
        locationPhone: '+237600000001',
        userPhone: '+237600000002',
        authPhone: '+237600000003',
      })
    ).toBe('+237600000002');
  });

  it('skips non-CM/GA profile phones so Auth0 can fill', () => {
    expect(
      resolveWithdrawDefaultPhone({
        isLocationAccount: false,
        userPhone: '+33612345678',
        authPhone: '+237670000000',
      })
    ).toBe('+237670000000');
  });
});
