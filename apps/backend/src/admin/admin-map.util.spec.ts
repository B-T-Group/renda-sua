import { AddressBits, AgentMapSource, LocationMapSource } from './admin-map.types';
import {
  mapAgentRow,
  mapLocationRow,
  mergePins,
  resolveAgentActivity,
} from './admin-map.util';

const douala: AddressBits = {
  address_line_1: '12 Akwa',
  city: 'Douala',
  state: 'Littoral',
  country: 'Cameroon',
  is_primary: true,
  latitude: 4.05,
  longitude: 9.7,
};

function agent(overrides: Partial<AgentMapSource> = {}): AgentMapSource {
  return {
    id: 'agent-1',
    status: 'active',
    is_available: true,
    user: {
      first_name: 'Awa',
      last_name: 'Ngo',
      email: 'awa@example.com',
      phone_number: '+237600000000',
    },
    agent_locations: [],
    agent_addresses: [{ address: douala }],
    ...overrides,
  };
}

describe('resolveAgentActivity', () => {
  it('marks available active agents as active', () => {
    expect(resolveAgentActivity('active', true)).toEqual({
      isActive: true,
      activity: 'active',
    });
  });

  it('marks unavailable agents separately from suspended agents', () => {
    expect(resolveAgentActivity('active', false).activity).toBe('unavailable');
    expect(resolveAgentActivity('suspended', true)).toEqual({
      isActive: false,
      activity: 'suspended',
    });
  });
});

describe('mapAgentRow', () => {
  const cameroon = { countryCode: 'CM', countryName: 'Cameroon' };

  it('prefers live GPS and keeps the registered market for filtering', () => {
    const pin = mapAgentRow(
      agent({
        agent_locations: [
          { latitude: '4.06', longitude: '9.71', updated_at: '2026-09-30T12:00:00Z' },
        ],
      }),
      cameroon
    );
    expect(pin).toMatchObject({
      positionSource: 'live_gps',
      latitude: 4.06,
      longitude: 9.71,
      lastSeenAt: '2026-09-30T12:00:00Z',
      phone: '+237600000000',
      isActive: true,
      state: 'Littoral',
    });
  });

  it('falls back to the primary address when there is no GPS fix', () => {
    const pin = mapAgentRow(agent(), cameroon);
    expect(pin).toMatchObject({
      positionSource: 'registered_address',
      latitude: 4.05,
      longitude: 9.7,
      lastSeenAt: null,
      title: 'Awa Ngo',
    });
  });

  it('drops agents outside the selected country or region', () => {
    expect(mapAgentRow(agent(), { countryCode: 'GA', countryName: 'Gabon' })).toBeNull();
    expect(mapAgentRow(agent(), { ...cameroon, state: 'Centre' })).toBeNull();
    expect(mapAgentRow(agent(), { ...cameroon, state: 'littoral' })?.id).toBe('agent-1');
  });

  it('matches a market region suffix to the short address state', () => {
    expect(
      mapAgentRow(agent(), { ...cameroon, state: 'Littoral Region Province' })?.id
    ).toBe('agent-1');
    expect(
      mapAgentRow(agent(), { ...cameroon, state: 'Estuaire Province' })
    ).toBeNull();
  });

  it('keeps a GPS-only agent when no market filter is set', () => {
    const pin = mapAgentRow(
      agent({
        agent_addresses: [],
        agent_locations: [{ latitude: 3.8, longitude: 11.5, updated_at: '2026-09-01T00:00:00Z' }],
      }),
      {}
    );
    expect(pin?.positionSource).toBe('live_gps');
    expect(pin?.addressLine).toBeNull();
  });
});

describe('mapLocationRow', () => {
  const location = (): LocationMapSource => ({
    id: 'loc-1',
    name: 'Akwa store',
    phone: '+237611111111',
    email: 'store@example.com',
    is_active: true,
    business: { name: 'Market Co' },
    address: douala,
  });

  it('plots an open merchant at its address', () => {
    const pin = mapLocationRow(location(), {
      countryCode: 'CM',
      countryName: 'Cameroon',
      state: 'Littoral',
    });
    expect(pin).toMatchObject({
      kind: 'business_location',
      activity: 'open',
      isActive: true,
      title: 'Akwa store',
      subtitle: 'Market Co',
      phone: '+237611111111',
    });
  });

  it('marks an inactive location and skips those outside the region', () => {
    const closed = location();
    closed.is_active = false;
    expect(mapLocationRow(closed, {}).activity).toBe('inactive');
    expect(
      mapLocationRow(location(), { countryCode: 'CM', countryName: 'Cameroon', state: 'Centre' })
    ).toBeNull();
  });
});

describe('mergePins', () => {
  it('returns only the requested rows that survive the filter', () => {
    const pins = mergePins([agent()], [], { countryName: 'Cameroon' });
    expect(pins).toHaveLength(1);
    expect(pins[0].kind).toBe('agent');
  });
});
