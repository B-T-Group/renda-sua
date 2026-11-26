import type { ExportOrderStatus } from './export-order.statuses';

export interface ExportOrderLine {
  id: string;
  item_id: string | null;
  business_inventory_id: string | null;
  product_name: string;
  characteristics: string | null;
  quantity: number;
  unit: string | null;
  particularities: string | null;
  unit_price: number | null;
  manufacturer_unit_cost: number | null;
  line_total: number | null;
  sort_order: number;
}

export interface ExportOrderRow {
  id: string;
  status: ExportOrderStatus;
  client_user_id: string;
  client_id: string | null;
  agent_user_id: string | null;
  business_id: string;
  business_location_id: string | null;
  country_code: string;
  currency: string;
  bc_number: string | null;
  bc_version: number;
  product_interest_request_id: string | null;
  balance_option: string | null;
  deposit_rate: number;
  credit_rate_full: number;
  credit_rate_30: number;
  credit_rate_60: number;
  manufacturer_cost_total: number | null;
  client_subtotal: number | null;
  fees_total: number;
  tax_total: number;
  grand_total: number | null;
  deposit_amount: number | null;
  balance_amount: number | null;
  credit_limit: number | null;
  has_open_dispute: boolean;
  bc_expires_at: string | null;
  proforma_expires_at: string | null;
  deposit_due_at: string | null;
  client_note: string | null;
  admin_notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  lines?: ExportOrderLine[];
  documents?: Array<{
    id: string;
    doc_type: string;
    document_number: string;
    version_number: number;
    upload_id: string | null;
    sha256: string | null;
    issued_at: string;
    locked: boolean;
  }>;
  invoices?: Array<{
    id: string;
    kind: string;
    document_id: string | null;
    version_number: number;
    subtotal: number;
    fees_total: number;
    tax_total: number;
    grand_total: number;
    deposit_rate: number;
    deposit_amount: number;
    balance_amount: number;
    credit_applied: number;
    validity_days: number;
    valid_until: string | null;
    client_approved_at: string | null;
    locked: boolean;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    currency: string;
    method: string;
    reference: string | null;
    value_date: string;
    allocation: string;
    receipt_document_id: string | null;
    voided_at: string | null;
    created_at: string;
  }>;
  shipments?: Array<{
    id: string;
    carrier: string | null;
    tracking_number: string | null;
    bill_of_lading: string | null;
    certificate_of_origin: string | null;
    dispatched_at: string | null;
    delivered_at: string | null;
    notes: string | null;
  }>;
  client_user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone_number: string | null;
  } | null;
  business?: {
    id: string;
    name: string | null;
    user_id: string;
  } | null;
}

export interface BankAccountSnapshot {
  id: string;
  institution: string;
  transit: string | null;
  account_number: string;
  swift: string | null;
  beneficiary: string;
  currency: string;
}
