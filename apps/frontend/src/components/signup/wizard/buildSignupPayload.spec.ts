import { buildSignupPayload } from './buildSignupPayload';
import { DEFAULT_SIGNUP_VALUES } from './types';

describe('buildSignupPayload', () => {
  it('strips store_location when business is not selected', () => {
    const payload = buildSignupPayload({
      ...DEFAULT_SIGNUP_VALUES,
      contact: {
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        phone: '+1234567890',
      },
      personas: ['client'],
      country: 'CM',
      storeLocation: {
        street: 'should not send',
        city: 'Douala',
        region: 'Littoral',
        postalCode: '',
      },
    });
    expect(payload.store_location).toBeUndefined();
    expect(payload.country).toBe('CM');
    expect(payload.personas).toEqual(['client']);
    expect(payload.profile.name).toBeUndefined();
  });

  it('includes store_location and business profile when business selected', () => {
    const payload = buildSignupPayload({
      ...DEFAULT_SIGNUP_VALUES,
      contact: {
        firstName: 'Biz',
        lastName: 'Owner',
        email: 'biz@example.com',
        phone: '+15145551234',
      },
      personas: ['business', 'client'],
      business: {
        name: 'Acme',
        mainInterest: 'sell_items',
        referralAgentCode: 'AB12CD',
      },
      country: 'ca',
      storeLocation: {
        street: '1 Main',
        city: 'Montreal',
        region: 'Quebec',
        postalCode: 'H2X1Y4',
      },
    });
    expect(payload.store_location).toEqual({
      street: '1 Main',
      city: 'Montreal',
      region: 'Quebec',
      postal_code: 'H2X1Y4',
      latitude: undefined,
      longitude: undefined,
    });
    expect(payload.profile.name).toBe('Acme');
    expect(payload.referral_agent_code).toBe('AB12CD');
    expect(payload.country).toBe('CA');
  });

  it('includes referral for agent without store_location', () => {
    const payload = buildSignupPayload({
      ...DEFAULT_SIGNUP_VALUES,
      contact: {
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        phone: '+1234567890',
      },
      personas: ['agent'],
      business: {
        name: '',
        mainInterest: 'sell_items',
        referralAgentCode: 'zz12yy',
      },
      country: 'CM',
    });
    expect(payload.store_location).toBeUndefined();
    expect(payload.referral_agent_code).toBe('ZZ12YY');
    expect(payload.profile.vehicle_type_id).toBe('other');
  });
});
