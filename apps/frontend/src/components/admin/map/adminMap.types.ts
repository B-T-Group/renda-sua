export type AdminMapKind = 'agents' | 'businesses' | 'all';
export type AdminMapPinKind = 'agent' | 'business_location';
export type AdminMapPositionSource = 'live_gps' | 'registered_address';
export type AdminMapActivity =
  | 'active'
  | 'unavailable'
  | 'suspended'
  | 'open'
  | 'inactive';

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

export interface AdminMapQuery {
  country: string;
  state: string;
  kind: AdminMapKind;
}

export const LIVE_POLL_MS = 15_000;
export const LABEL_ZOOM = 13;
