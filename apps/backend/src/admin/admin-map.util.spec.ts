import { AddressBits, AgentMapSource, LocationMapSource } from './admin-map.types';
import {
  activeOrdersWhere,
  agentSearchHit,
  mapAgentRow,
  mapLocationRow,
  mergePins,
  orderMapHolder,
  orderSearchHit,
  personNameWhere,
  pinsForKind,
  resolveAgentActivity,
  summarizeMarket,
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

describe('summarizeMarket', () => {
  const cameroon = { countryCode: 'CM', countryName: 'Cameroon', state: 'Littoral' };

  it('counts agents and merchants in the market by status, including those without a pin', () => {
    const noGps = { ...douala, latitude: null, longitude: null };
    const agents = [
      agent(),
      agent({ id: 'agent-2', is_available: false, agent_addresses: [{ address: noGps }] }),
      agent({ id: 'agent-3', status: 'suspended' }),
    ];
    const locations = [
      merchant(true),
      merchant(false, { id: 'loc-2', address: noGps }),
    ];
    expect(summarizeMarket(agents, locations, cameroon)).toEqual({
      agents: { active: 1, unavailable: 1, suspended: 1 },
      merchants: { open: 1, inactive: 1 },
    });
    expect(mergePins(agents, locations, cameroon)).toHaveLength(3);
  });

  it('leaves out people outside the selected region', () => {
    const summary = summarizeMarket(
      [agent({ agent_addresses: [{ address: { ...douala, state: 'Centre' } }] })],
      [],
      cameroon
    );
    expect(summary.agents).toEqual({ active: 0, unavailable: 0, suspended: 0 });
  });
});

describe('orderMapHolder', () => {
  it('keeps an open order at the business until an agent picks it up', () => {
    expect(orderMapHolder('preparing', 'delivery')).toBe('business');
    expect(orderMapHolder('assigned_to_agent', 'delivery')).toBe('business');
    expect(orderMapHolder('ready_for_pickup', 'pickup')).toBe('business');
  });

  it('follows the agent only after pickup, and skips closed or carrier orders', () => {
    expect(orderMapHolder('picked_up', 'delivery')).toBe('agent');
    expect(orderMapHolder('in_transit', 'delivery')).toBe('agent');
    expect(orderMapHolder('complete', 'delivery')).toBe('closed');
    expect(orderMapHolder('cancelled', 'delivery')).toBe('closed');
    expect(orderMapHolder('shipped', 'shipping')).toBe('carrier');
  });
});

describe('activeOrdersWhere', () => {
  it('lists only open orders and narrows by order number when typed', () => {
    const open = activeOrdersWhere('') as { current_status: { _nin: string[] } };
    expect(open.current_status._nin).toEqual(
      expect.arrayContaining(['complete', 'cancelled'])
    );
    expect(open.current_status._nin).not.toContain('preparing');
    expect(activeOrdersWhere('ORD-9')).toEqual({
      _and: [open, { order_number: { _ilike: '%ORD-9%' } }],
    });
  });
});

describe('orderSearchHit', () => {
  it('zooms to the agent who is carrying an active order', () => {
    const hit = orderSearchHit({
      id: 'order-1',
      order_number: 'ORD-1',
      current_status: 'in_transit',
      fulfillment_method: 'delivery',
      assigned_agent: agent(),
      business_location: merchant(true),
    });
    expect(hit.notice).toBeNull();
    expect(hit.pin).toMatchObject({ kind: 'agent', id: 'agent-1' });
  });

  it('does not place a completed order on the map', () => {
    const hit = orderSearchHit({
      id: 'order-2',
      order_number: 'ORD-2',
      current_status: 'complete',
      fulfillment_method: 'delivery',
      business_location: merchant(true),
    });
    expect(hit.pin).toBeNull();
    expect(hit.notice).toBe('inactive');
  });
});

describe('agentSearchHit', () => {
  it('matches each part of a name and still returns an agent with no coordinates', () => {
    expect(personNameWhere(['Awa', 'Ngo'])).toEqual({
      _and: [
        { _or: [{ user: { first_name: { _ilike: '%Awa%' } } }, { user: { last_name: { _ilike: '%Awa%' } } }] },
        { _or: [{ user: { first_name: { _ilike: '%Ngo%' } } }, { user: { last_name: { _ilike: '%Ngo%' } } }] },
      ],
    });
    const hit = agentSearchHit(agent({ agent_addresses: [{ address: { ...douala, latitude: null, longitude: null } }] }));
    expect(hit.title).toBe('Awa Ngo');
    expect(hit.notice).toBe('no_location');
  });
});

describe('pinsForKind', () => {
  it('keeps only the selected kind', () => {
    const pins = mergePins([agent()], [merchant(true)], { countryName: 'Cameroon' });
    expect(pinsForKind(pins, 'agents')).toHaveLength(1);
    expect(pinsForKind(pins, 'businesses')[0].kind).toBe('business_location');
  });
});

function merchant(open: boolean, overrides: Partial<LocationMapSource> = {}): LocationMapSource {
  return {
    id: 'loc-1',
    name: 'Akwa store',
    is_active: open,
    address: douala,
    ...overrides,
  };
}
