import {
  hasExistingReferrer,
  mapAdminReferredBy,
  pickReferralCode,
} from './admin-referral.util';

describe('admin-referral.util', () => {
  it('prefers the user referral code over the legacy persona code', () => {
    expect(pickReferralCode('USR001', 'AGT001')).toBe('USR001');
    expect(pickReferralCode('', 'AGT001')).toBe('AGT001');
    expect(pickReferralCode(null, null)).toBe('');
  });

  it('maps an agent referrer name before a business referrer', () => {
    expect(
      mapAdminReferredBy(
        { user: { first_name: 'Ada', last_name: 'Lovelace' } },
        { name: 'Shop' },
        'ABC123'
      )
    ).toEqual({ kind: 'agent', name: 'Ada Lovelace', codeUsed: 'ABC123' });
  });

  it('maps a business referrer when no agent name is present', () => {
    expect(mapAdminReferredBy(null, { name: 'Shop' }, 'XYZ789')).toEqual({
      kind: 'business',
      name: 'Shop',
      codeUsed: 'XYZ789',
    });
  });

  it('still maps a referrer when the FK is set but the display name is empty', () => {
    expect(
      mapAdminReferredBy(
        { user: { first_name: '', last_name: '' } },
        null,
        'ABC123',
        'agent-id',
        null
      )
    ).toEqual({ kind: 'agent', name: 'Agent', codeUsed: 'ABC123' });
    expect(mapAdminReferredBy(null, { name: '  ' }, null, null, 'biz-id')).toEqual({
      kind: 'business',
      name: 'Business',
      codeUsed: null,
    });
  });

  it('detects an existing referrer', () => {
    expect(hasExistingReferrer({})).toBe(false);
    expect(hasExistingReferrer({ referred_by_agent_id: 'a1' })).toBe(true);
    expect(hasExistingReferrer({ referred_by_business_id: 'b1' })).toBe(true);
  });
});
