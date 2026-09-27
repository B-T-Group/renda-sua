import { describe, expect, it } from 'vitest';
import { pickClaimTopupPhone } from './defaultClaimTopupPhone';

describe('pickClaimTopupPhone', () => {
  it('uses the default linked Mobile Money number', () => {
    const actual = pickClaimTopupPhone({
      linkedPhones: [
        { phone_e164: '+237611111111', is_default: false },
        { phone_e164: '+237622222222', is_default: true },
      ],
      profilePhone: '+237600000000',
      authPhone: '+237633333333',
    });
    expect(actual).toBe('+237622222222');
  });

  it('falls back to the users-table phone, then the session phone', () => {
    expect(
      pickClaimTopupPhone({
        linkedPhones: [],
        profilePhone: '+237600000000',
        authPhone: '+237633333333',
      })
    ).toBe('+237600000000');
    expect(
      pickClaimTopupPhone({
        linkedPhones: [],
        profilePhone: '',
        authPhone: '+237633333333',
      })
    ).toBe('+237633333333');
  });
});
