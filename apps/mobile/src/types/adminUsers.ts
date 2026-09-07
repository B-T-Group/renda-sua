export type AdminReferredBy = {
  kind: 'agent' | 'business';
  name: string;
  codeUsed: string | null;
};

/** Shared user shape used in all admin user-list responses. */
export interface AdminUserProfile {
  id: string;
  identifier?: string;
  email?: string | null;
  first_name: string;
  last_name: string;
  phone_number?: string | null;
}

/** One entry in GET /admin/clients */
export interface AdminClientUser {
  id: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
  user: AdminUserProfile;
  accounts?: Array<{
    id: string;
    currency: string;
    available_balance: number;
    total_balance: number;
    is_active?: boolean;
  }>;
  addresses?: Array<{
    id: string;
    city?: string;
    country?: string;
    is_primary?: boolean;
  }>;
}

export interface AdminClientsListResult {
  items: AdminClientUser[];
  total: number;
  page: number;
  limit: number;
}

/** One entry in GET /admin/agents */
export interface AdminAgentUser {
  id: string;
  user_id: string;
  created_at?: string;
  is_verified: boolean;
  is_internal: boolean;
  status?: string;
  vehicle_type_id?: string | null;
  vehicle_type?: { id: string; name: string } | null;
  referralCode?: string;
  referredBy?: AdminReferredBy | null;
  user: AdminUserProfile;
  addresses?: Array<{
    id: string;
    city?: string;
    country?: string;
  }>;
}

export interface AdminAgentsListResult {
  items: AdminAgentUser[];
  total: number;
  page: number;
  limit: number;
}
