-- Export orders domain (B2B): statuses, documents, finance, financing, commissions.
-- Separate from consumer marketplace orders.

CREATE TABLE IF NOT EXISTS public.export_order_status_enum_seed (
  status text PRIMARY KEY
);
INSERT INTO public.export_order_status_enum_seed (status) VALUES
  ('SUBMITTED'),
  ('IN_REVIEW'),
  ('CHANGES_REQUESTED'),
  ('REJECTED'),
  ('MFR_QUOTE'),
  ('PROFORMA_ISSUED'),
  ('INVOICED'),
  ('DEPOSIT_REQUIRED'),
  ('DEPOSIT_RECEIVED'),
  ('CANCELLED'),
  ('IN_PRODUCTION'),
  ('READY'),
  ('BALANCE_REQUIRED'),
  ('PAID_IN_FULL'),
  ('FINANCED_30'),
  ('FINANCED_60'),
  ('SHIPPED'),
  ('DELIVERED'),
  ('CLOSED'),
  ('REVIEWED')
ON CONFLICT DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS public.export_bc_seq;
CREATE SEQUENCE IF NOT EXISTS public.export_pro_seq;
CREATE SEQUENCE IF NOT EXISTS public.export_fac_seq;
CREATE SEQUENCE IF NOT EXISTS public.export_rec_seq;
CREATE SEQUENCE IF NOT EXISTS public.export_cr_seq;

CREATE OR REPLACE FUNCTION public.next_export_doc_number(
  p_prefix text,
  p_country text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  year_part text := to_char(now() AT TIME ZONE 'UTC', 'YYYY');
  seq_val bigint;
  country_part text;
BEGIN
  IF p_prefix = 'BC' THEN
    seq_val := nextval('public.export_bc_seq');
    country_part := upper(coalesce(nullif(trim(p_country), ''), 'XX'));
    RETURN format('BC-%s-%s-%s', country_part, year_part, lpad(seq_val::text, 6, '0'));
  ELSIF p_prefix = 'PRO' THEN
    seq_val := nextval('public.export_pro_seq');
    RETURN format('PRO-%s-%s', year_part, lpad(seq_val::text, 6, '0'));
  ELSIF p_prefix = 'FAC' THEN
    seq_val := nextval('public.export_fac_seq');
    RETURN format('FAC-%s-%s', year_part, lpad(seq_val::text, 6, '0'));
  ELSIF p_prefix = 'REC' THEN
    seq_val := nextval('public.export_rec_seq');
    RETURN format('REC-%s-%s', year_part, lpad(seq_val::text, 6, '0'));
  ELSIF p_prefix = 'CR' THEN
    seq_val := nextval('public.export_cr_seq');
    RETURN format('CR-%s-%s', year_part, lpad(seq_val::text, 4, '0'));
  ELSE
    RAISE EXCEPTION 'Unknown export doc prefix %', p_prefix;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.export_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL,
  transit text,
  account_number text NOT NULL,
  swift text,
  beneficiary text NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  is_active boolean NOT NULL DEFAULT true,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.export_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'SUBMITTED'
    REFERENCES public.export_order_status_enum_seed(status),
  client_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  agent_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  business_location_id uuid REFERENCES public.business_locations(id) ON DELETE SET NULL,
  country_code text NOT NULL DEFAULT 'CM',
  currency text NOT NULL DEFAULT 'CAD',
  bc_number text,
  bc_version int NOT NULL DEFAULT 1,
  product_interest_request_id uuid REFERENCES public.product_interest_requests(id) ON DELETE SET NULL,
  balance_option text
    CHECK (balance_option IS NULL OR balance_option = ANY (ARRAY['FULL','FINANCED_30','FINANCED_60'])),
  deposit_rate numeric(6,4) NOT NULL DEFAULT 0.4000,
  credit_rate_full numeric(6,4) NOT NULL DEFAULT 0.0500,
  credit_rate_30 numeric(6,4) NOT NULL DEFAULT 0.0250,
  credit_rate_60 numeric(6,4) NOT NULL DEFAULT 0,
  manufacturer_cost_total numeric(14,2),
  client_subtotal numeric(14,2),
  fees_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2),
  deposit_amount numeric(14,2),
  balance_amount numeric(14,2),
  credit_limit numeric(14,2),
  has_open_dispute boolean NOT NULL DEFAULT false,
  bc_expires_at timestamptz,
  proforma_expires_at timestamptz,
  deposit_due_at timestamptz,
  client_note text,
  admin_notes text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS export_orders_status_created_idx
  ON public.export_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS export_orders_client_user_id_idx
  ON public.export_orders (client_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS export_orders_agent_user_id_idx
  ON public.export_orders (agent_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS export_orders_business_id_idx
  ON public.export_orders (business_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS export_orders_bc_number_uidx
  ON public.export_orders (bc_number) WHERE bc_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.export_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  business_inventory_id uuid REFERENCES public.business_inventory(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  characteristics text,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  unit text DEFAULT 'ea',
  particularities text,
  unit_price numeric(14,2),
  manufacturer_unit_cost numeric(14,2),
  line_total numeric(14,2),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS export_order_lines_order_idx
  ON public.export_order_lines (export_order_id, sort_order);

CREATE TABLE IF NOT EXISTS public.export_order_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  version_kind text NOT NULL CHECK (version_kind = ANY (ARRAY['BC','PROFORMA'])),
  version_number int NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (export_order_id, version_kind, version_number)
);

CREATE TABLE IF NOT EXISTS public.export_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision = ANY (ARRAY['APPROVE','CHANGES_REQUESTED','REJECT'])),
  notes text,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS export_reviews_order_idx
  ON public.export_reviews (export_order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.export_manufacturer_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  confirmed_prices jsonb,
  lead_time_days int,
  valid_until timestamptz,
  attachment_upload_id uuid REFERENCES public.user_uploads(id) ON DELETE SET NULL,
  notes text,
  confirmed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.export_additional_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  fee_type text NOT NULL CHECK (fee_type = ANY (ARRAY[
    'freight_maritime','customs_departure','export_prep','other'
  ])),
  label text NOT NULL,
  description text,
  intervenant text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.export_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type = ANY (ARRAY[
    'BC','PRO','FAC','REC','CR','SHIPMENT','COM'
  ])),
  document_number text NOT NULL,
  version_number int NOT NULL DEFAULT 1,
  upload_id uuid REFERENCES public.user_uploads(id) ON DELETE SET NULL,
  sha256 text,
  bank_account_snapshot jsonb,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  locked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_number)
);
CREATE INDEX IF NOT EXISTS export_documents_order_idx
  ON public.export_documents (export_order_id, doc_type, version_number);

CREATE OR REPLACE FUNCTION public.export_documents_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.locked IS TRUE THEN
    RAISE EXCEPTION 'export_documents row % is locked and immutable', OLD.id;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.locked IS TRUE THEN
    RAISE EXCEPTION 'export_documents row % is locked and cannot be deleted', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS export_documents_immutable_trg ON public.export_documents;
CREATE TRIGGER export_documents_immutable_trg
  BEFORE UPDATE OR DELETE ON public.export_documents
  FOR EACH ROW EXECUTE FUNCTION public.export_documents_immutable();

CREATE TABLE IF NOT EXISTS public.export_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['PROFORMA','INVOICE'])),
  document_id uuid REFERENCES public.export_documents(id) ON DELETE SET NULL,
  version_number int NOT NULL DEFAULT 1,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  fees_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  deposit_rate numeric(6,4) NOT NULL DEFAULT 0.4000,
  deposit_amount numeric(14,2) NOT NULL DEFAULT 0,
  balance_amount numeric(14,2) NOT NULL DEFAULT 0,
  credit_applied numeric(14,2) NOT NULL DEFAULT 0,
  validity_days int NOT NULL DEFAULT 7,
  valid_until timestamptz,
  client_approved_at timestamptz,
  client_approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  bank_account_snapshot jsonb,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS export_invoices_order_idx
  ON public.export_invoices (export_order_id, kind, version_number);

CREATE TABLE IF NOT EXISTS public.export_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  method text NOT NULL DEFAULT 'wire',
  reference text,
  value_date date NOT NULL DEFAULT CURRENT_DATE,
  allocation text NOT NULL DEFAULT 'deposit'
    CHECK (allocation = ANY (ARRAY['deposit','balance','financing_repayment','other'])),
  recorded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  receipt_document_id uuid REFERENCES public.export_documents(id) ON DELETE SET NULL,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS export_payments_order_idx
  ON public.export_payments (export_order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.export_payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  label text NOT NULL,
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending','paid','overdue','cancelled'])),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.export_supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['deposit','balance'])),
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  paid_at timestamptz NOT NULL DEFAULT now(),
  proof_upload_id uuid REFERENCES public.user_uploads(id) ON DELETE SET NULL,
  reference text,
  recorded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.export_financing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  option_days int NOT NULL CHECK (option_days = ANY (ARRAY[30,60])),
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  due_date date,
  principal numeric(14,2) NOT NULL DEFAULT 0,
  late_fee_rate_monthly numeric(6,4) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending','approved','active','paid','overdue','cancelled'])),
  last_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (export_order_id)
);

CREATE TABLE IF NOT EXISTS public.export_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid REFERENCES public.export_orders(id) ON DELETE SET NULL,
  client_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  document_number text NOT NULL UNIQUE,
  amount numeric(14,2) NOT NULL,
  reason text NOT NULL,
  linked_invoice_id uuid REFERENCES public.export_invoices(id) ON DELETE SET NULL,
  expires_at timestamptz,
  document_id uuid REFERENCES public.export_documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.export_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  export_order_id uuid REFERENCES public.export_orders(id) ON DELETE SET NULL,
  credit_note_id uuid REFERENCES public.export_credit_notes(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type = ANY (ARRAY['accrued','applied','expired','reversed'])),
  amount numeric(14,2) NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS export_credit_ledger_client_idx
  ON public.export_credit_ledger (client_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.export_order_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE UNIQUE,
  manufacturer_cost numeric(14,2) NOT NULL DEFAULT 0,
  client_price numeric(14,2) NOT NULL DEFAULT 0,
  fees_passthrough numeric(14,2) NOT NULL DEFAULT 0,
  rendasua_revenue numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.export_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  agent_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  payment_id uuid REFERENCES public.export_payments(id) ON DELETE SET NULL,
  base_amount numeric(14,2) NOT NULL,
  rate numeric(8,6) NOT NULL,
  amount numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'accrued'
    CHECK (status = ANY (ARRAY['accrued','payable','paid','reversed'])),
  statement_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS export_commissions_agent_idx
  ON public.export_commissions (agent_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.export_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  carrier text,
  tracking_number text,
  bill_of_lading text,
  certificate_of_origin text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.export_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_order_id uuid NOT NULL REFERENCES public.export_orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text,
  event_name text NOT NULL,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS export_audit_log_order_idx
  ON public.export_audit_log (export_order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.export_client_profiles (
  client_user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  legal_identifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  kyc_status text NOT NULL DEFAULT 'pending'
    CHECK (kyc_status = ANY (ARRAY['pending','approved','rejected'])),
  credit_limit numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.document_types (id, name, description) VALUES
  (40, 'export_bc', 'Export purchase order (bon de commande)'),
  (41, 'export_proforma', 'Export proforma invoice'),
  (42, 'export_invoice', 'Export commercial invoice'),
  (43, 'export_receipt', 'Export payment receipt'),
  (44, 'export_credit_note', 'Export credit note')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.permissions (key, description, category) VALUES
  ('platform.export.review', 'Review and price export orders (Canada admin)', 'ops'),
  ('platform.export.finance', 'Record export payments and bank accounts', 'finance')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key IN ('order_manager', 'support', 'superuser')
  AND p.key = 'platform.export.review'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key IN ('finance', 'superuser')
  AND p.key = 'platform.export.finance'
ON CONFLICT DO NOTHING;

-- order_manager may not exist on older DBs; also grant review to finance for dual-hat admins
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'finance'
  AND p.key = 'platform.export.review'
ON CONFLICT DO NOTHING;

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'export_orders_enabled',
  'Export orders workflow',
  'When true, “I’m interested” creates an export_orders row at SUBMITTED instead of interest-only lead. Country row first, then global; default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['export', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'export_orders_enabled' AND country_code IS NULL
);

INSERT INTO public.message_types (id, comment)
VALUES
  ('EXPORT_ORDER_SUBMITTED', 'Export order submitted / BC issued'),
  ('EXPORT_ORDER_STATUS', 'Export order status change'),
  ('EXPORT_PROFORMA_ISSUED', 'Export proforma issued'),
  ('EXPORT_INVOICE_ISSUED', 'Export invoice issued'),
  ('EXPORT_PAYMENT_RECORDED', 'Export payment recorded'),
  ('EXPORT_FINANCING_REMINDER', 'Export financing reminder')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.export_orders_assign_bc()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.bc_number IS NULL OR NEW.bc_number = '' THEN
    NEW.bc_number := public.next_export_doc_number('BC', NEW.country_code);
  END IF;
  IF NEW.bc_expires_at IS NULL THEN
    NEW.bc_expires_at := now() + interval '30 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS export_orders_assign_bc_trg ON public.export_orders;
CREATE TRIGGER export_orders_assign_bc_trg
  BEFORE INSERT ON public.export_orders
  FOR EACH ROW EXECUTE FUNCTION public.export_orders_assign_bc();

COMMENT ON TABLE public.export_orders IS
  'B2B export order lifecycle (distinct from consumer marketplace orders).';
