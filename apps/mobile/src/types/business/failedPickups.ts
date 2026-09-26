export type FailedPickup = {
  id: string;
  order_id: string;
  business_id: string;
  reason_id: string;
  notes?: string | null;
  status: 'pending' | 'completed';
  refund_amount: number;
  fee_retained: number;
  currency: string;
  fulfillment_method?: string | null;
  created_at: string;
  updated_at: string;
  order?: {
    id: string;
    order_number: string;
    current_status: string;
    total_amount: number;
    currency: string;
    client?: {
      id: string;
      user?: {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone_number?: string;
      };
    };
  };
  failure_reason?: {
    id: string;
    reason_key: string;
    reason_en: string;
    reason_fr: string;
  };
};
