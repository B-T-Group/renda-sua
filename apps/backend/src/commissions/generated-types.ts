// Generated types for Partners table
export interface Partners {
  __typename?: 'partners';
  id: string;
  user_id: string;
  company_name: string;
  base_delivery_fee_commission: number;
  per_km_delivery_fee_commission: number;
  item_commission: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Generated types for Commission_Payouts table
export interface Commission_Payouts {
  __typename?: 'commission_payouts';
  id: string;
  order_id: string;
  recipient_user_id: string;
  recipient_type: 'partner' | 'rendasua' | 'agent' | 'business';
  commission_type:
    | 'base_delivery_fee'
    | 'per_km_delivery_fee'
    | 'item_sale'
    | 'order_subtotal';
  amount: number;
  currency: string;
  commission_percentage?: number;
  account_transaction_id: string;
  created_at: string;
  updated_at: string;
}

// Query response types
export interface GetPartnersQuery {
  partners: Partners[];
}

export interface GetRendasuaHQUserQuery {
  users: Array<{
    id: string;
    user_type_id: string;
    identifier: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  }>;
}

export interface InsertCommissionPayoutMutation {
  insert_commission_payouts_one: {
    id: string;
  };
}

// Input types
export interface Commission_Payouts_Insert_Input {
  order_id: string;
  recipient_user_id: string;
  recipient_type: 'partner' | 'rendasua' | 'agent' | 'business';
  commission_type:
    | 'base_delivery_fee'
    | 'per_km_delivery_fee'
    | 'item_sale'
    | 'order_subtotal';
  amount: number;
  currency: string;
  commission_percentage?: number;
  account_transaction_id: string;
}
