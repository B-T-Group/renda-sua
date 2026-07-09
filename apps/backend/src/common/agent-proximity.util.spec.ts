import {
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
});
