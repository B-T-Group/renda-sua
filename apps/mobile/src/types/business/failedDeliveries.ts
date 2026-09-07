export type FailedDeliveryStatus = 'pending' | 'completed';

export type FailedDeliveryResolutionType =
  | 'agent_fault'
  | 'client_fault'
  | 'item_fault';

export interface FailedDeliveryUser {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
}

export interface FailedDeliveryAddress {
  id?: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface FailedDelivery {
  id: string;
  order_id: string;
  failure_reason_id: string;
  notes?: string | null;
  status: FailedDeliveryStatus;
  resolution_type?: FailedDeliveryResolutionType | null;
  outcome?: string | null;
  created_at: string;
  resolved_at?: string | null;
  order: {
    id: string;
    order_number: string;
    current_status: string;
    total_amount: number;
    currency: string;
    created_at?: string;
    client?: {
      id?: string;
      user?: FailedDeliveryUser | null;
    } | null;
    assigned_agent?: {
      id?: string;
      user?: FailedDeliveryUser | null;
    } | null;
    delivery_address?: FailedDeliveryAddress | null;
  };
  failure_reason?: {
    id?: string;
    reason_key?: string | null;
    reason_en?: string | null;
    reason_fr?: string | null;
  } | null;
}

export interface ResolutionRequest {
  resolution_type: FailedDeliveryResolutionType;
  outcome: string;
  restore_inventory?: boolean;
}

export function failedDeliveryPersonName(
  user?: FailedDeliveryUser | null
): string {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  return name;
}
