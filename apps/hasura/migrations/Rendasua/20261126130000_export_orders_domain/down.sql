DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id FROM public.permissions
  WHERE key IN ('platform.export.review', 'platform.export.finance')
);

DELETE FROM public.permissions
WHERE key IN ('platform.export.review', 'platform.export.finance');

DELETE FROM public.application_configurations
WHERE config_key = 'export_orders_enabled';

DELETE FROM public.message_types
WHERE id IN (
  'EXPORT_ORDER_SUBMITTED',
  'EXPORT_ORDER_STATUS',
  'EXPORT_PROFORMA_ISSUED',
  'EXPORT_INVOICE_ISSUED',
  'EXPORT_PAYMENT_RECORDED',
  'EXPORT_FINANCING_REMINDER'
);

DELETE FROM public.document_types WHERE id IN (40, 41, 42, 43, 44);

DROP TRIGGER IF EXISTS export_orders_assign_bc_trg ON public.export_orders;
DROP FUNCTION IF EXISTS public.export_orders_assign_bc();
DROP TRIGGER IF EXISTS export_documents_immutable_trg ON public.export_documents;
DROP FUNCTION IF EXISTS public.export_documents_immutable();
DROP FUNCTION IF EXISTS public.next_export_doc_number(text, text);

DROP TABLE IF EXISTS public.export_audit_log;
DROP TABLE IF EXISTS public.export_shipments;
DROP TABLE IF EXISTS public.export_commissions;
DROP TABLE IF EXISTS public.export_order_revenue;
DROP TABLE IF EXISTS public.export_credit_ledger;
DROP TABLE IF EXISTS public.export_credit_notes;
DROP TABLE IF EXISTS public.export_financing;
DROP TABLE IF EXISTS public.export_supplier_payments;
DROP TABLE IF EXISTS public.export_payment_schedules;
DROP TABLE IF EXISTS public.export_payments;
DROP TABLE IF EXISTS public.export_invoices;
DROP TABLE IF EXISTS public.export_documents;
DROP TABLE IF EXISTS public.export_additional_fees;
DROP TABLE IF EXISTS public.export_manufacturer_quotes;
DROP TABLE IF EXISTS public.export_reviews;
DROP TABLE IF EXISTS public.export_order_versions;
DROP TABLE IF EXISTS public.export_order_lines;
DROP TABLE IF EXISTS public.export_client_profiles;
DROP TABLE IF EXISTS public.export_orders;
DROP TABLE IF EXISTS public.export_bank_accounts;
DROP TABLE IF EXISTS public.export_order_status_enum_seed;

DROP SEQUENCE IF EXISTS public.export_bc_seq;
DROP SEQUENCE IF EXISTS public.export_pro_seq;
DROP SEQUENCE IF EXISTS public.export_fac_seq;
DROP SEQUENCE IF EXISTS public.export_rec_seq;
DROP SEQUENCE IF EXISTS public.export_cr_seq;
