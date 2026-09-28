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

  it('uses the first linked number when none is the default', () => {
    expect(
      pickClaimTopupPhone(
        [{ phone_e164: ' +237611111111 ' }, { phone_e164: '+237622222222' }],
        '+237600000000'
      )
    ).toBe('+237611111111');
  });

  it('does not send a blank default or a blank profile', () => {
    expect(
      pickClaimTopupPhone(
        [
          { phone_e164: '   ', is_default: true },
          { phone_e164: '+237611111111' },
        ],
        '  '
      )
    ).toBe('');
    expect(pickClaimTopupPhone(undefined, null)).toBe('');
  });
});
