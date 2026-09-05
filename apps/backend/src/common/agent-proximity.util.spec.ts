import {
  addressesMatchRegion,
  agentMatchesRegion,
  countryFromAddresses,
  regionFromAddresses,
  resolveAgentOperatingRegion,
  resolveAgentPreviewCountry,
} from './agent-proximity.util';

describe('agent-proximity.util', () => {
  const addresses = [
    {
      address: { country: 'CM', state: 'Littoral', is_primary: true },
    },
  ];

  it('regionFromAddresses returns primary country and state', () => {
    expect(regionFromAddresses(addresses)).toEqual({
      country: 'CM',
      state: 'Littoral',
    });
  });

  it('resolveAgentOperatingRegion prefers profile address over GPS', async () => {
    const region = await resolveAgentOperatingRegion({
      agentAddresses: addresses,
      agentLocation: { latitude: 1, longitude: 2 },
      reverseGeocode: async () => ({ country: 'GA', state: 'Estuaire' }),
    });
    expect(region).toEqual({ country: 'CM', state: 'Littoral' });
  });

  it('resolveAgentOperatingRegion falls back to GPS reverse geocode', async () => {
    const region = await resolveAgentOperatingRegion({
      agentAddresses: [],
      agentLocation: { latitude: 3.8, longitude: 11.5 },
      reverseGeocode: async () => ({ country: 'CM', state: 'Centre' }),
    });
    expect(region).toEqual({ country: 'CM', state: 'Centre' });
  });

  it('resolveAgentOperatingRegion returns null when no address or GPS', async () => {
    const region = await resolveAgentOperatingRegion({
      agentAddresses: [],
      agentLocation: null,
    });
    expect(region).toBeNull();
  });

  it('resolveAgentOperatingRegion uses agent_location when address has country only', async () => {
    const region = await resolveAgentOperatingRegion({
      agentAddresses: [
        { address: { country: 'CM', state: '', is_primary: true } },
      ],
      agentLocation: { latitude: 3.8, longitude: 11.5 },
      reverseGeocode: async () => ({ country: 'CM', state: 'Centre' }),
    });
    expect(region).toEqual({ country: 'CM', state: 'Centre' });
  });

  it('resolveAgentOperatingRegion prefers agent_location over country-only address', async () => {
    const region = await resolveAgentOperatingRegion({
      agentAddresses: [
        { address: { country: 'GA', state: '', is_primary: true } },
      ],
      agentLocation: { latitude: 3.8, longitude: 11.5 },
      reverseGeocode: async () => ({ country: 'CM', state: 'Centre' }),
    });
    expect(region).toEqual({ country: 'CM', state: 'Centre' });
  });

  it('countryFromAddresses returns country when state is empty', () => {
    expect(
      countryFromAddresses([
        { address: { country: 'CM', state: '', is_primary: true } },
      ])
    ).toBe('CM');
  });

  it('resolveAgentPreviewCountry prefers address country over GPS', async () => {
    const country = await resolveAgentPreviewCountry({
      agentAddresses: [{ address: { country: 'GA', state: '', is_primary: true } }],
      agentLocation: { latitude: 1, longitude: 2 },
      reverseGeocode: async () => ({ country: 'CM', state: 'Centre' }),
    });
    expect(country).toBe('GA');
  });

  it('resolveAgentPreviewCountry falls back to GPS country', async () => {
    const country = await resolveAgentPreviewCountry({
      agentAddresses: [],
      agentLocation: { latitude: 3.8, longitude: 11.5 },
      reverseGeocode: async () => ({ country: 'CM', state: 'Centre' }),
    });
    expect(country).toBe('CM');
  });

  it('agentMatchesRegion matches via GPS when addresses absent', async () => {
    const matches = await agentMatchesRegion({
      agentAddresses: [],
      agentLocation: { latitude: 3.8, longitude: 11.5 },
      targetCountry: 'CM',
      targetState: 'Centre',
      reverseGeocode: async () => ({ country: 'CM', state: 'Centre' }),
    });
    expect(matches).toBe(true);
  });

  it('addressesMatchRegion treats Québec and Quebec as the same state', () => {
    expect(
      addressesMatchRegion(
        [{ address: { country: 'CA', state: 'Québec', is_primary: true } }],
        'CA',
        'Quebec'
      )
    ).toBe(true);
  });

  it('addressesMatchRegion ignores case and surrounding whitespace', () => {
    expect(
      addressesMatchRegion(
        [{ address: { country: '  ca ', state: '  QUÉBEC ', is_primary: true } }],
        'CA',
        'quebec'
      )
    ).toBe(true);
  });

  it('addressesMatchRegion rejects empty or missing country/state', () => {
    expect(addressesMatchRegion([], 'CA', 'Quebec')).toBe(false);
    expect(
      addressesMatchRegion(
        [{ address: { country: 'CA', state: '', is_primary: true } }],
        'CA',
        'Quebec'
      )
    ).toBe(false);
    expect(
      addressesMatchRegion(
        [{ address: { country: 'CA', state: 'Quebec', is_primary: true } }],
        'CA',
        ''
      )
    ).toBe(false);
  });

  it('agentMatchesRegion matches profile accents without calling GPS', async () => {
    const reverseGeocode = jest.fn();
    const matches = await agentMatchesRegion({
      agentAddresses: [
        { address: { country: 'CA', state: 'Québec', is_primary: true } },
      ],
      agentLocation: { latitude: 45.5, longitude: -73.6 },
      targetCountry: 'CA',
      targetState: 'Quebec',
      reverseGeocode,
    });
    expect(matches).toBe(true);
    expect(reverseGeocode).not.toHaveBeenCalled();
  });

  it('agentMatchesRegion does not match a different country', async () => {
    const matches = await agentMatchesRegion({
      agentAddresses: [
        { address: { country: 'CA', state: 'Quebec', is_primary: true } },
      ],
      targetCountry: 'CM',
      targetState: 'Quebec',
    });
    expect(matches).toBe(false);
  });
});
