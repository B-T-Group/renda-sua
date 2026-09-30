export const ADMIN_MAP_KINDS = ['agents', 'businesses', 'all'] as const;
export type AdminMapKind = (typeof ADMIN_MAP_KINDS)[number];

export type AdminMapPinKind = 'agent' | 'business_location';
export type AdminMapPositionSource = 'live_gps' | 'registered_address';
export type AdminMapActivity =
  | 'active'
  | 'unavailable'
  | 'suspended'
  | 'open'
  | 'inactive';

export interface AdminMapFilter {
  countryCode?: string;
  countryName?: string | null;
  state?: string;
}

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

export interface AddressBits {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  is_primary?: boolean | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface GpsBits {
  latitude?: number | string | null;
  longitude?: number | string | null;
  updated_at?: string | null;
}

export interface AgentMapSource {
  id: string;
  status?: string | null;
  is_available?: boolean | null;
  user?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone_number?: string | null;
  } | null;
  agent_locations?: GpsBits[] | null;
  agent_addresses?: Array<{ address?: AddressBits | null }> | null;
}

export interface LocationMapSource {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean | null;
  business?: { name?: string | null } | null;
  address?: AddressBits | null;
}
