import {
  AddressBits,
  AdminMapActivity,
  AdminMapFilter,
  AdminMapKind,
  AdminMapPin,
  AdminMapSearchHit,
  AdminMapSearchNotice,
  AdminMapSummary,
  AgentMapSource,
  GpsBits,
  LocationMapSource,
  OrderMapHolder,
  OrderMapSource,
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

export function emptyMapSummary(): AdminMapSummary {
  return {
    agents: { active: 0, unavailable: 0, suspended: 0 },
    merchants: { open: 0, inactive: 0 },
  };
}

const CLOSED_ORDER_STATUSES = new Set([
  'cancelled',
  'complete',
  'delivered',
  'failed',
  'refunded',
  'refund_requested',
  'refund_approved_full',
  'refund_approved_partial',
  'refund_rejected',
  'refund_approved_replace',
  'refund_processing',
  'refund_failed',
]);
const AGENT_HELD_STATUSES = new Set(['picked_up', 'in_transit', 'out_for_delivery']);
const CARRIER_STATUSES = new Set(['shipped', 'in_delivery']);

export function orderMapHolder(
  status: string,
  fulfillment?: string | null
): OrderMapHolder {
  if (CLOSED_ORDER_STATUSES.has(status)) return 'closed';
  if (fulfillment === 'pickup') return 'business';
  if (AGENT_HELD_STATUSES.has(status)) return 'agent';
  if (CARRIER_STATUSES.has(status)) return 'carrier';
  return 'business';
}

export function searchTokens(raw: string): string[] {
  return raw.trim().split(/\s+/).filter(Boolean).slice(0, 4);
}

export function personNameWhere(tokens: string[]) {
  return { _and: tokens.map((token) => nameToken(token)) };
}

export function merchantNameWhere(tokens: string[]) {
  return { _and: tokens.map((token) => merchantToken(token)) };
}

export function orderNumberWhere(term: string) {
  return { order_number: { _ilike: likePattern(term.replace(/\s+/g, '')) } };
}

export function activeOrdersWhere(term: string) {
  const open = { current_status: { _nin: [...CLOSED_ORDER_STATUSES] } };
  const compact = term.trim();
  if (!compact) return open;
  return { _and: [open, orderNumberWhere(compact)] };
}

export function agentSearchHit(agent: AgentMapSource): AdminMapSearchHit {
  const pin = mapAgentRow(agent, {});
  return {
    id: agent.id,
    kind: 'agent',
    title: personName(agent.user),
    subtitle: hitSubtitle(agent.user?.email, pin?.subtitle ?? null),
    pin,
    notice: pin ? null : 'no_location',
  };
}

export function locationSearchHit(row: LocationMapSource): AdminMapSearchHit {
  const pin = mapLocationRow(row, {});
  return {
    id: row.id,
    kind: 'business_location',
    title: row.name || row.business?.name || 'Location',
    subtitle: hitSubtitle(row.email, row.business?.name && row.name ? row.business.name : null),
    pin,
    notice: pin ? null : 'no_location',
  };
}

export function orderSearchHit(order: OrderMapSource): AdminMapSearchHit {
  const holder = orderMapHolder(order.current_status, order.fulfillment_method);
  const pin = pinForHolder(holder, order);
  return {
    id: order.id,
    kind: 'order',
    title: order.order_number,
    subtitle: order.current_status,
    pin,
    notice: orderNotice(holder, pin),
  };
}

export function pinsForKind(pins: AdminMapPin[], kind: AdminMapKind): AdminMapPin[] {
  if (kind === 'agents') return pins.filter((pin) => pin.kind === 'agent');
  if (kind === 'businesses') return pins.filter((pin) => pin.kind === 'business_location');
  return pins;
}

export function summarizeMarket(
  agents: AgentMapSource[],
  locations: LocationMapSource[],
  filter: AdminMapFilter
): AdminMapSummary {
  const summary = emptyMapSummary();
  agents.filter((row) => inMarket(pickAgentAddress(row), filter)).forEach((row) => {
    countAgent(summary, resolveAgentActivity(row.status, row.is_available).activity);
  });
  locations.filter((row) => inMarket(row.address, filter)).forEach((row) => {
    countMerchant(summary, row.is_active === true);
  });
  return summary;
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

function nameToken(token: string) {
  const pattern = likePattern(token);
  return {
    _or: [
      { user: { first_name: { _ilike: pattern } } },
      { user: { last_name: { _ilike: pattern } } },
      { user: { email: { _ilike: pattern } } },
    ],
  };
}

function merchantToken(token: string) {
  const pattern = likePattern(token);
  return {
    _or: [
      { name: { _ilike: pattern } },
      { email: { _ilike: pattern } },
      { business: { name: { _ilike: pattern } } },
      { business: { user: { email: { _ilike: pattern } } } },
    ],
  };
}

function hitSubtitle(email: string | null | undefined, extra: string | null): string | null {
  const mail = (email || '').trim();
  if (!mail) return extra;
  if (!extra || extra === mail) return mail;
  return `${mail} · ${extra}`;
}

function likePattern(token: string): string {
  return `%${token.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
}

function pinForHolder(holder: OrderMapHolder, order: OrderMapSource): AdminMapPin | null {
  if (holder === 'agent' && order.assigned_agent) return mapAgentRow(order.assigned_agent, {});
  if (holder === 'business' && order.business_location) {
    return mapLocationRow(order.business_location, {});
  }
  return null;
}

function orderNotice(
  holder: OrderMapHolder,
  pin: AdminMapPin | null
): AdminMapSearchNotice | null {
  if (holder === 'closed') return 'inactive';
  if (holder === 'carrier') return 'carrier';
  return pin ? null : 'no_location';
}

function inMarket(
  address: { country?: string | null; state?: string | null } | null | undefined,
  filter: AdminMapFilter
): boolean {
  return addressMatchesMarket(address ?? null, filter);
}

function countAgent(summary: AdminMapSummary, activity: AdminMapActivity) {
  if (activity === 'active' || activity === 'unavailable' || activity === 'suspended') {
    summary.agents[activity] += 1;
  }
}

function countMerchant(summary: AdminMapSummary, open: boolean) {
  summary.merchants[open ? 'open' : 'inactive'] += 1;
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
