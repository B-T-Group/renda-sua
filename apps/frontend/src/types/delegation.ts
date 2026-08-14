export interface DelegationRoleSummary {
  id: string;
  key: string;
  name: string;
  description?: string;
  is_assignable?: boolean;
}

export interface DelegationGrant {
  id: string;
  locationId: string;
  locationName: string;
  businessId: string;
  businessName: string;
  role: DelegationRoleSummary;
  permissions: string[];
}

export type ActiveContext =
  | { kind: 'persona'; persona: 'client' | 'agent' | 'business' }
  | { kind: 'delegation'; delegationId: string };

export interface DelegationTeamMember {
  id: string;
  status: string;
  user?: {
    id: string;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  };
  business_location_id: string;
  location?: { id: string; name: string };
  role?: { id: string; key: string; name: string };
  permissions?: string[];
}

export interface DelegationTeamInvite {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  first_name?: string | null;
  last_name?: string | null;
  business_location_id: string;
  location?: { id: string; name: string };
  role?: { id: string; key: string; name: string };
  permissions?: string[];
}

export interface InvitePreview {
  business_name: string;
  location_name: string;
  inviter_first_name: string;
  expires_at: string;
  needs_name: boolean;
  role_name: string;
}

export const DELEGATION_PERMISSIONS = {
  ORDERS_READ: 'delegation.orders.read',
  ORDERS_MANAGE: 'delegation.orders.manage',
  ITEMS_READ: 'delegation.items.read',
  ITEMS_MANAGE: 'delegation.items.manage',
} as const;
