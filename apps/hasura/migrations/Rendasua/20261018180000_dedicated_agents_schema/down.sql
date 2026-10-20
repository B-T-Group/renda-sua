-- Reverse of 20261018180000_dedicated_agents_schema.
DROP INDEX IF EXISTS public.order_offers_dedicated_outstanding_idx;
ALTER TABLE public.order_offers
  DROP CONSTRAINT IF EXISTS order_offers_decline_reason_check,
  DROP CONSTRAINT IF EXISTS order_offers_offer_kind_check,
  DROP COLUMN IF EXISTS decline_reason,
  DROP COLUMN IF EXISTS offer_kind;

DROP INDEX IF EXISTS public.orders_dedicated_assignment_idx;
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_dedicated_assignment_id_fkey,
  DROP CONSTRAINT IF EXISTS orders_assignment_source_check,
  DROP CONSTRAINT IF EXISTS orders_coverage_slot_key_check,
  DROP COLUMN IF EXISTS dedicated_release_until,
  DROP COLUMN IF EXISTS assignment_source,
  DROP COLUMN IF EXISTS dedicated_assignment_id,
  DROP COLUMN IF EXISTS coverage_slot_key;

DROP TABLE IF EXISTS public.dedicated_agent_assignments;
DROP FUNCTION IF EXISTS public.dedicated_agent_assignments_enforce_cap();
DROP TABLE IF EXISTS public.dedicated_agent_applications;
DROP TABLE IF EXISTS public.dedicated_agent_posting_slots;
DROP TABLE IF EXISTS public.dedicated_agent_postings;
DROP FUNCTION IF EXISTS public.dedicated_agent_postings_sync_slots();
DROP TABLE IF EXISTS public.business_location_pickup_slots;

DELETE FROM public.location_delegation_role_permissions
 WHERE permission_id IN (
   SELECT id FROM public.location_delegation_permissions WHERE key = 'delegation.dedicated_agents.manage'
 );
DELETE FROM public.location_delegation_permissions WHERE key = 'delegation.dedicated_agents.manage';

DELETE FROM public.application_configurations
 WHERE country_code IS NULL
   AND config_key IN (
     'dedicated_agents_enabled',
     'dedicated_offer_ttl_seconds',
     'dedicated_max_active_orders',
     'dedicated_max_assignments_per_agent',
     'dedicated_auto_assign_release_seconds',
     'dedicated_slot_reminder_minutes',
     'dedicated_posting_expiry_days',
     'dedicated_slot_end_grace_minutes'
   );
