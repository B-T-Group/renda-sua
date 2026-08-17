import { buildPersonaFragments } from './persona-provisioners';

describe('buildPersonaFragments', () => {
  it('builds client + agent fragments without store address', () => {
    const frags = buildPersonaFragments({
      personas: ['client', 'agent'],
      vehicle_type_id: 'bike',
    });
    expect(frags).toHaveLength(2);
    expect(frags[0].objectField).toContain('client');
    expect(frags[1].objectField).toContain('agent');
    expect(frags[1].vars.vehicle_type_id).toBe('bike');
    expect(frags[1].vars.agent_focus).toBe('both');
  });

  it('persists an explicit agent focus on signup', () => {
    const frags = buildPersonaFragments({
      personas: ['agent'],
      vehicle_type_id: 'bike',
      agent_focus: 'commercial',
    });
    expect(frags).toHaveLength(1);
    expect(frags[0].vars.agent_focus).toBe('commercial');
    expect(frags[0].objectField).toContain('focus: $agent_focus');
  });

  it('nests business_locations when store address is present', () => {
    const frags = buildPersonaFragments({
      personas: ['business'],
      business_name: 'Acme',
      main_interest: 'sell_items',
      storeAddress: {
        address_line_1: '1 Main',
        country: 'CA',
        city: 'Montreal',
        state: 'Quebec',
        postal_code: 'H2X1Y4',
        countryOnly: false,
      },
    });
    expect(frags).toHaveLength(1);
    expect(frags[0].objectField).toContain('business_locations');
    expect(frags[0].objectField).toContain('address:');
    expect(frags[0].vars.bl_name).toBe('Acme - Montreal');
    expect(frags[0].vars.addr_postal).toBe('H2X1Y4');
  });

  it('writes referred_by_business_id for B2B business referral', () => {
    const frags = buildPersonaFragments({
      personas: ['business'],
      business_name: 'Acme',
      business_referral_business_id: 'biz-ref-1',
      business_referral_code_used: 'BIZCODE',
    });
    expect(frags[0].vars.referred_by_business_id).toBe('biz-ref-1');
    expect(frags[0].vars.referral_code_used).toBe('BIZCODE');
    expect(frags[0].objectField).toContain(
      'referred_by_business_id: $referred_by_business_id'
    );
    expect(frags[0].objectField).not.toContain('referred_by_agent_id');
  });

  it('writes referred_by_agent_id for agent-referred businesses', () => {
    const frags = buildPersonaFragments({
      personas: ['business'],
      business_name: 'Acme',
      business_referral_agent_id: 'agent-1',
      business_referral_code_used: 'AGTCODE',
    });
    expect(frags[0].vars.referred_by_agent_id).toBe('agent-1');
    expect(frags[0].objectField).toContain(
      'referred_by_agent_id: $referred_by_agent_id'
    );
  });

  it('omits business referral fields when the code is missing', () => {
    const frags = buildPersonaFragments({
      personas: ['business'],
      business_name: 'Acme',
      business_referral_business_id: 'biz-ref-1',
    });
    expect(frags[0].vars.referred_by_business_id).toBeUndefined();
    expect(frags[0].objectField).not.toContain('referred_by_business_id');
  });

  it('writes agent B2B referral fields onto the agent insert', () => {
    const frags = buildPersonaFragments({
      personas: ['agent'],
      vehicle_type_id: 'bike',
      agent_referral_business_id: 'biz-ref-1',
      agent_referral_code_used: 'BIZCODE',
    });
    expect(frags[0].vars.agent_referred_by_business_id).toBe('biz-ref-1');
    expect(frags[0].objectField).toContain(
      'referred_by_business_id: $agent_referred_by_business_id'
    );
    expect(frags[0].objectField).not.toContain('referred_by_agent_id');
  });

  it('skips nested location for country-only address', () => {
    const frags = buildPersonaFragments({
      personas: ['business'],
      business_name: 'Acme',
      storeAddress: {
        address_line_1: '',
        country: 'CM',
        city: '',
        state: '',
        postal_code: '',
        countryOnly: true,
      },
    });
    expect(frags[0].objectField).not.toContain('business_locations');
  });
});
