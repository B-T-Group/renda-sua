import { pickClaimTopupPhone } from './defaultClaimTopupPhone';

describe('pickClaimTopupPhone', () => {
  it('uses the default linked Mobile Money number', () => {
    const actual = pickClaimTopupPhone(
      [
        { phone_e164: '+237611111111', is_default: false },
        { phone_e164: '+237622222222', is_default: true },
      ],
      '+237600000000'
    );
    expect(actual).toBe('+237622222222');
  });

  it('falls back to the users-table phone when none is linked', () => {
    expect(pickClaimTopupPhone([], '+237600000000')).toBe('+237600000000');
    expect(pickClaimTopupPhone(null, '  +237600000000  ')).toBe('+237600000000');
  });
});
