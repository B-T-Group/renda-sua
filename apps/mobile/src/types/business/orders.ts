import type { Order } from '../agent';

export type BusinessOrder = Order & {
  reconciliation_status?: 'none' | 'pending_manual_reconciliation' | 'reconciled';
  payment_status?: string;
};

/** Hasura-style status filter (string equality or operator object). */
export type BusinessOrderStatusFilter =
  | string
  | { _eq?: string; _in?: string[]; _nin?: string[] };

export interface BusinessOrderFilters {
  search?: string;
  status?: string;
  current_status?: BusinessOrderStatusFilter;
  reconciliation_status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ConfirmOrderPayload {
  orderId: string;
  notes?: string;
  delivery_time_window_id?: string;
  delivery_window_details?: {
    slot_id: string;
    preferred_date: string;
    special_instructions?: string;
  };
}

export interface OrderActionPayload {
  orderId: string;
  notes?: string;
}

export interface ReconcileCashPayload {
  customerPhone: string;
  reference?: string;
  notes?: string;
}
