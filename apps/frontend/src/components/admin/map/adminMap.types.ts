export type AdminMapKind = 'agents' | 'businesses' | 'all';
export type AdminMapPinKind = 'agent' | 'business_location';
export type AdminMapPositionSource = 'live_gps' | 'registered_address';
export type AdminMapActivity =
  | 'active'
  | 'unavailable'
  | 'suspended'
  | 'open'
  | 'inactive';
export type AdminMapActivityFilter = AdminMapActivity | '';

export interface AdminMapPin {
  id: string;
  kind: AdminMapPinKind;
  latitude: number;
  longitude: number;
  positionSource: AdminMapPositionSource;
  title: string;
  subtitle: string | null;
  isActive: boolean;
  activity: AdminMapActivity;
  lastSeenAt: string | null;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  country: string | null;
  state: string | null;
}

export interface AdminMapSummary {
  agents: { active: number; unavailable: number; suspended: number };
  merchants: { open: number; inactive: number };
}

export const EMPTY_MAP_SUMMARY: AdminMapSummary = {
  agents: { active: 0, unavailable: 0, suspended: 0 },
  merchants: { open: 0, inactive: 0 },
};

export interface AdminMapQuery {
  country: string;
  state: string;
  kind: AdminMapKind;
}

export type AdminMapSearchNotice = 'inactive' | 'no_location' | 'carrier';

export interface AdminMapSearchHit {
  id: string;
  kind: 'agent' | 'business_location' | 'order';
  title: string;
  subtitle: string | null;
  pin: AdminMapPin | null;
  notice: AdminMapSearchNotice | null;
}

const AGENT_ACTIVITIES: AdminMapActivity[] = ['active', 'unavailable', 'suspended'];
const MERCHANT_ACTIVITIES: AdminMapActivity[] = ['open', 'inactive'];

export function activitiesForKind(kind: AdminMapKind): AdminMapActivity[] {
  if (kind === 'agents') return AGENT_ACTIVITIES;
  if (kind === 'businesses') return MERCHANT_ACTIVITIES;
  return [...AGENT_ACTIVITIES, ...MERCHANT_ACTIVITIES];
}

export const LIVE_POLL_MS = 15_000;
export const LABEL_ZOOM = 13;
export const FOCUS_ZOOM = 16;
