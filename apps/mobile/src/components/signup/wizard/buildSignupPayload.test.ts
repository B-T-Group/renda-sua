import { describe, expect, it } from 'vitest';
import { buildSignupPayload } from './buildSignupPayload';
import {
  createDefaultSignupValues,
  legacyUserTypeFromPersonas,
} from './types';

describe('legacyUserTypeFromPersonas', () => {
  it('prefers agent over business over client', () => {
    expect(legacyUserTypeFromPersonas(['client', 'business', 'agent'])).toBe(
      'agent'
    );
    expect(legacyUserTypeFromPersonas(['client', 'business'])).toBe('business');
    expect(legacyUserTypeFromPersonas(['client'])).toBe('client');
  });
});

describe('buildSignupPayload', () => {
  it('sends country without store_location for client-only', () => {
    const values = createDefaultSignupValues('CM');
    values.contact.firstName = 'Ada';
    values.contact.lastName = 'Lovelace';
    values.contact.email = 'ada@example.com';
    values.personas = ['client'];

    const payload = buildSignupPayload({
      values,
      phoneE164: '+237600000000',
    });

    expect(payload.country).toBe('CM');
    expect(payload.store_location).toBeUndefined();
    expect(payload.address).toBeUndefined();
    expect(payload.personas).toEqual(['client']);
    expect(payload.user_type_id).toBe('client');
    expect(payload.profile).toEqual({
      name: undefined,
      main_interest: undefined,
      vehicle_type_id: undefined,
      agent_focus: undefined,
    });
  });

  it('includes vehicle_type_id for agent without store_location', () => {
    const values = createDefaultSignupValues('GA');
    values.contact.firstName = 'A';
    values.contact.lastName = 'B';
    values.contact.email = 'a@b.com';
    values.personas = ['agent'];

    const payload = buildSignupPayload({ values, phoneE164: null });
    expect(payload.profile.vehicle_type_id).toBe('other');
    expect(payload.profile.agent_focus).toBe('both');
    expect(payload.store_location).toBeUndefined();
    expect(payload.country).toBe('GA');
  });

  it('includes store_location and referral for business', () => {
    const values = createDefaultSignupValues('CA');
    values.contact.firstName = 'Biz';
    values.contact.lastName = 'Owner';
    values.contact.email = 'biz@example.com';
    values.personas = ['business'];
    values.business.name = 'Acme';
    values.business.mainInterest = 'rent_items';
    values.business.referralAgentCode = 'abc123';
    values.storeLocation = {
      address_line_1: '1 Main St',
      address_line_2: '',
      city: 'Toronto',
      state: 'ON',
      postal_code: 'M5V1A1',
      country: 'CA',
      latitude: 43.6,
      longitude: -79.4,
    };

    const payload = buildSignupPayload({
      values,
      phoneE164: '+14165550100',
    });

    expect(payload.user_type_id).toBe('business');
    expect(payload.profile.name).toBe('Acme');
    expect(payload.profile.main_interest).toBe('rent_items');
    expect(payload.store_location).toEqual({
      street: '1 Main St',
      city: 'Toronto',
      region: 'ON',
      postal_code: 'M5V1A1',
      latitude: 43.6,
      longitude: -79.4,
    });
    expect(payload.referral_agent_code).toBe('ABC123');
    expect(payload.address).toBeUndefined();
  });

  it('includes referral for agent signup without store_location', () => {
    const values = createDefaultSignupValues('CM');
    values.contact.firstName = 'A';
    values.contact.lastName = 'B';
    values.contact.email = 'a@b.com';
    values.personas = ['agent'];
    values.business.referralAgentCode = 'xy99zz';

    const payload = buildSignupPayload({ values, phoneE164: null });
    expect(payload.profile.vehicle_type_id).toBe('other');
    expect(payload.store_location).toBeUndefined();
    expect(payload.referral_agent_code).toBe('XY99ZZ');
  });

  it('handles multi-persona client+business', () => {
    const values = createDefaultSignupValues('US');
    values.contact.firstName = 'M';
    values.contact.lastName = 'P';
    values.contact.email = 'm@p.com';
    values.personas = ['client', 'business'];
    values.business.name = 'Shop';
    values.storeLocation = {
      address_line_1: '2 Oak',
      address_line_2: '',
      city: 'Austin',
      state: 'TX',
      postal_code: '78701',
      country: 'US',
    };

    const payload = buildSignupPayload({ values, phoneE164: null });
    expect(payload.personas).toEqual(['client', 'business']);
    expect(payload.user_type_id).toBe('business');
    expect(payload.store_location?.street).toBe('2 Oak');
  });
});
