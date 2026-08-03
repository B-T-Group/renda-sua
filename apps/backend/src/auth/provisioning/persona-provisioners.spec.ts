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
