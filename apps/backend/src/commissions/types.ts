export interface Partner {
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

export interface CommissionBreakdown {
  baseDeliveryFee: {
    agent: number;
    partner: number;
    rendasua: number;
  };
  perKmDeliveryFee: {
    agent: number;
    partner: number;
    rendasua: number;
  };
  itemCommission: {
    partner: number;
    rendasua: number;
  };
  orderSubtotal: {
    business: number;
    rendasua: number;
  };
}

export interface CommissionPayout {
  recipientUserId: string;
  recipientType: 'partner' | 'rendasua' | 'agent' | 'business';
  commissionType:
    | 'base_delivery_fee'
    | 'per_km_delivery_fee'
    | 'item_sale'
    | 'order_subtotal';
  amount: number;
  currency: string;
  commissionPercentage?: number;
}

export interface CommissionConfig {
  rendasuaItemCommissionPercentage: number;
  unverifiedAgentBaseDeliveryCommission: number;
  verifiedAgentBaseDeliveryCommission: number;
  unverifiedAgentPerKmDeliveryCommission: number;
  verifiedAgentPerKmDeliveryCommission: number;
}
