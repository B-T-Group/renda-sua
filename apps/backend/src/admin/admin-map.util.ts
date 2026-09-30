import {
  AddressBits,
  AdminMapActivity,
  AdminMapFilter,
  AdminMapPin,
  AgentMapSource,
  GpsBits,
  LocationMapSource,
} from './admin-map.types';

export function normalizeCountryCode(value?: string): string | null {
  const code = (value || '').trim().toUpperCase();
  return code.length === 2 ? code : null;
}

export function toCoord(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function addressMatchesMarket(
  address: { country?: string | null; state?: string | null } | null,
  filter: AdminMapFilter
): boolean {
  if (!hasMarketFilter(filter)) return true;
  if (!address) return false;
  if (!countryMatches(address.country, filter)) return false;
  return stateMatches(address.state, filter.state);
}

export function resolveAgentActivity(
  status: string | null | undefined,
  isAvailable: boolean | null | undefined
): { isActive: boolean; activity: AdminMapActivity } {
  if (status === 'suspended') {
    return { isActive: false, activity: 'suspended' };
  }
  if (status === 'active' && isAvailable === true) {
    return { isActive: true, activity: 'active' };
  }
  return { isActive: false, activity: 'unavailable' };
}

export function mapAgentRow(
  agent: AgentMapSource,
  filter: AdminMapFilter
): AdminMapPin | null {
  const address = pickAgentAddress(agent);
  if (!addressMatchesMarket(address, filter)) return null;
  const coords = pickAgentCoords(agent);
  if (!coords) return null;
  return buildAgentPin(agent, address, coords);
}

export function mapLocationRow(
  row: LocationMapSource,
  filter: AdminMapFilter
): AdminMapPin | null {
  const address = row.address ?? null;
  if (!addressMatchesMarket(address, filter)) return null;
  const coords = addressCoords(address);
  if (!coords || !address) return null;
  return buildLocationPin(row, address, coords);
}

export function mergePins(
  agents: AgentMapSource[],
  locations: LocationMapSource[],
  filter: AdminMapFilter
): AdminMapPin[] {
  const agentPins = agents
    .map((row) => mapAgentRow(row, filter))
    .filter((pin): pin is AdminMapPin => pin !== null);
  const locationPins = locations
    .map((row) => mapLocationRow(row, filter))
    .filter((pin): pin is AdminMapPin => pin !== null);
  return [...agentPins, ...locationPins];
}

export function uniqueStateNames(rows: Array<{ state_name?: string | null }>): string[] {
  const names = rows
    .map((row) => (row.state_name || '').trim())
    .filter((name) => name.length > 0);
  return [...new Set(names)];
}

function hasMarketFilter(filter: AdminMapFilter): boolean {
  return Boolean(filter.countryCode || filter.countryName || filter.state);
}

function countryMatches(
  country: string | null | undefined,
  filter: AdminMapFilter
): boolean {
  if (!filter.countryCode && !filter.countryName) return true;
  const value = (country || '').trim().toLowerCase();
  const code = (filter.countryCode || '').trim().toLowerCase();
  const name = (filter.countryName || '').trim().toLowerCase();
  return value === code || (name.length > 0 && value === name);
}

function stateMatches(
  state: string | null | undefined,
  expected?: string
): boolean {
  if (!expected?.trim()) return true;
  const actual = stateKey(state || '');
  const wanted = stateKey(expected);
  if (!actual || !wanted) return false;
  return actual === wanted;
}

/** Market rows use "Littoral Region Province"; addresses store "Littoral". */
function stateKey(value: string): string {
  let key = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const suffix of [' region province', ' province', ' region']) {
    if (key.endsWith(suffix)) {
      key = key.slice(0, -suffix.length).trim();
      break;
    }
  }
  return key;
}

function pickAgentAddress(agent: AgentMapSource): AddressBits | null {
  const rows = (agent.agent_addresses ?? [])
    .map((row) => row.address)
    .filter((address): address is AddressBits => Boolean(address));
  return rows.find((address) => address.is_primary) ?? rows[0] ?? null;
}

function latestGps(rows: GpsBits[] | null | undefined): GpsBits | null {
  const list = rows ?? [];
  if (!list.length) return null;
  return [...list].sort((a, b) =>
    (b.updated_at || '').localeCompare(a.updated_at || '')
  )[0];
}

function addressCoords(address: AddressBits | null): CoordPick | null {
  const latitude = toCoord(address?.latitude);
  const longitude = toCoord(address?.longitude);
  if (latitude === null || longitude === null) return null;
  return {
    latitude,
    longitude,
    positionSource: 'registered_address',
    lastSeenAt: null,
  };
}

function pickAgentCoords(agent: AgentMapSource): CoordPick | null {
  const gps = latestGps(agent.agent_locations);
  const latitude = toCoord(gps?.latitude);
  const longitude = toCoord(gps?.longitude);
  if (latitude !== null && longitude !== null) {
    return {
      latitude,
      longitude,
      positionSource: 'live_gps',
      lastSeenAt: gps?.updated_at ?? null,
    };
  }
  return addressCoords(pickAgentAddress(agent));
}

function buildAgentPin(
  agent: AgentMapSource,
  address: AddressBits | null,
  coords: CoordPick
): AdminMapPin {
  const activity = resolveAgentActivity(agent.status, agent.is_available);
  return {
    id: agent.id,
    kind: 'agent',
    ...coords,
    title: personName(agent.user),
    subtitle: address?.city || address?.state || null,
    ...activity,
    phone: agent.user?.phone_number ?? null,
    email: agent.user?.email ?? null,
    addressLine: formatAddressLine(address),
    country: address?.country ?? null,
    state: address?.state ?? null,
  };
}

function buildLocationPin(
  row: LocationMapSource,
  address: AddressBits,
  coords: CoordPick
): AdminMapPin {
  const open = row.is_active === true;
  return {
    id: row.id, kind: 'business_location', ...coords,
    title: row.name || row.business?.name || 'Location',
    subtitle: row.business?.name ?? null,
    isActive: open, activity: open ? 'open' : 'inactive', lastSeenAt: null,
    phone: row.phone ?? null, email: row.email ?? null,
    addressLine: formatAddressLine(address),
    country: address.country ?? null, state: address.state ?? null,
  };
}

function personName(
  user: AgentMapSource['user']
): string {
  const name = [user?.first_name, user?.last_name]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' ');
  return name || user?.email || 'Agent';
}

function formatAddressLine(address: AddressBits | null): string | null {
  if (!address) return null;
  const line = [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.country,
  ]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');
  return line || null;
}

interface CoordPick {
  latitude: number;
  longitude: number;
  positionSource: AdminMapPin['positionSource'];
  lastSeenAt: string | null;
}
