-- #594 Dedicated delivery agents + business pickup slots: schema, config keys (PR 1 of 8).
-- Everything is dark behind application_configurations.dedicated_agents_enabled (default false).
-- Additive only: new tables; new nullable columns (or constant defaults, metadata-only on PG >= 11)
-- on orders / order_offers, with CHECK / FK constraints added NOT VALID (still enforced for new
-- writes) and validated in the next migration, in its own transaction, so the hot tables are not
-- scanned while this migration holds ACCESS EXCLUSIVE locks. No backfill: a location with
-- no business_location_pickup_slots row means "slot enabled, no pickup time" (AC-B1 default on).
-- Writes to the new tables go through the backend (system role); Hasura roles get read-only access.
-- Locks: ALTER TABLE takes ACCESS EXCLUSIVE on orders / order_offers for the rest of this
-- transaction, so this file does no scans of those tables (the two partial indexes are built in
-- 20261018180001 under SHARE). lock_timeout makes the migration fail fast instead of queueing every
-- orders query behind a long-running reader; re-run it if it times out.

SET LOCAL lock_timeout = '5s';

-- 1. Config keys (global rows). Never a blind insert.
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value, number_value,
  country_code, status, version, tags
)
SELECT v.config_key, v.config_name, v.description, v.data_type, v.boolean_value, v.number_value,
       NULL, 'active', 1, ARRAY['dedicated-agents']::text[] || v.extra_tags
FROM (VALUES
  ('dedicated_agents_enabled', 'Dedicated agents enabled',
   'Master switch for #594 dedicated delivery agents and pickup slots (coverage, offers, auto-assign, postings, admin). Default false; turned on globally at launch.',
   'boolean', false, NULL::numeric, ARRAY['feature-flag']::text[]),
  ('dedicated_offer_ttl_seconds', 'Dedicated offer TTL (seconds)',
   'Seconds a dedicated fallback offer stays acceptable before it expires and cascades.',
   'number', NULL, 120, ARRAY['offers']::text[]),
  ('dedicated_max_active_orders', 'Dedicated max active orders per agent',
   'Agent is eligible for dedicated coverage only while active orders (all rails) + outstanding dedicated offers are below this.',
   'number', NULL, 10, ARRAY['capacity']::text[]),
  ('dedicated_max_assignments_per_agent', 'Dedicated max assignments per agent',
   'Maximum live (active or paused) store-slot assignments per agent. Enforced by trigger.',
   'number', NULL, 3, ARRAY['capacity']::text[]),
  ('dedicated_auto_assign_release_seconds', 'Dedicated auto-assign release window (seconds)',
   'How long an auto-assigned internal agent can release the order ("Can''t take this") with no strike.',
   'number', NULL, 120, ARRAY['auto-assign']::text[]),
  ('dedicated_slot_reminder_minutes', 'Dedicated slot reminder (minutes before start)',
   'Day-of reminder to agents with scheduled dedicated orders, this many minutes before the slot starts.',
   'number', NULL, 30, ARRAY['notifications']::text[]),
  ('dedicated_posting_expiry_days', 'Dedicated posting expiry (days)',
   'Open postings expire after this many days.',
   'number', NULL, 14, ARRAY['postings']::text[]),
  ('dedicated_slot_end_grace_minutes', 'Dedicated slot end grace (minutes)',
   'Grace after slot end during which a dedicated agent can still be matched.',
   'number', NULL, 15, ARRAY['coverage']::text[])
) AS v(config_key, config_name, description, data_type, boolean_value, number_value, extra_tags)
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations c
  WHERE c.config_key = v.config_key AND c.country_code IS NULL
);

-- 2. Delegation permission for business delegates (enforced in the backend, like delegation.orders.*).
INSERT INTO public.location_delegation_permissions (key, description, category)
VALUES ('delegation.dedicated_agents.manage',
        'Manage pickup slots, dedicated agents, postings and applicants at a location', 'dedicated_agents')
ON CONFLICT (key) DO NOTHING;

-- 3. Per-location pickup slot settings (AC-B1/B2). Bounds come from delivery_time_slots.
CREATE TABLE IF NOT EXISTS public.business_location_pickup_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_location_id uuid NOT NULL REFERENCES public.business_locations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  slot_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  pickup_time time,
  updated_by_user_id uuid REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_location_pickup_slots_location_slot_key UNIQUE (business_location_id, slot_key),
  CONSTRAINT business_location_pickup_slots_slot_key_check CHECK (slot_key IN ('morning', 'afternoon', 'evening'))
);

-- 4. Postings (AC-B11..B13, D11). One open posting per location-slot via dedicated_agent_posting_slots.
CREATE TABLE IF NOT EXISTS public.dedicated_agent_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_location_id uuid NOT NULL REFERENCES public.business_locations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  headcount smallint NOT NULL DEFAULT 1,
  accepted_count smallint NOT NULL DEFAULT 0,
  days_of_week smallint[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[],
  terms text,
  terms_updated_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  filled_at timestamptz,
  closed_at timestamptz,
  closed_by_user_id uuid REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  closed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dedicated_agent_postings_id_location_key UNIQUE (id, business_location_id),
  CONSTRAINT dedicated_agent_postings_headcount_check CHECK (headcount BETWEEN 1 AND 10),
  CONSTRAINT dedicated_agent_postings_accepted_check CHECK (accepted_count >= 0 AND accepted_count <= headcount),
  CONSTRAINT dedicated_agent_postings_days_check CHECK (
    cardinality(days_of_week) BETWEEN 1 AND 7
    AND days_of_week <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]
  ),
  CONSTRAINT dedicated_agent_postings_terms_check CHECK (terms IS NULL OR char_length(terms) <= 1000),
  CONSTRAINT dedicated_agent_postings_status_check CHECK (status IN ('open', 'filled', 'closed', 'expired')),
  CONSTRAINT dedicated_agent_postings_filled_check CHECK (status <> 'filled' OR accepted_count = headcount)
);
CREATE INDEX IF NOT EXISTS dedicated_agent_postings_location_idx ON public.dedicated_agent_postings (business_location_id);
CREATE INDEX IF NOT EXISTS dedicated_agent_postings_open_expiry_idx ON public.dedicated_agent_postings (expires_at) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.dedicated_agent_posting_slots (
  posting_id uuid NOT NULL,
  business_location_id uuid NOT NULL,
  slot_key text NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  PRIMARY KEY (posting_id, slot_key),
  CONSTRAINT dedicated_agent_posting_slots_posting_fkey FOREIGN KEY (posting_id, business_location_id)
    REFERENCES public.dedicated_agent_postings (id, business_location_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT dedicated_agent_posting_slots_slot_key_check CHECK (slot_key IN ('morning', 'afternoon', 'evening'))
);
CREATE UNIQUE INDEX IF NOT EXISTS dedicated_agent_posting_slots_one_open_idx
  ON public.dedicated_agent_posting_slots (business_location_id, slot_key) WHERE is_open;

-- Keep posting_slots.is_open in step with the posting status (single writer for the unique rule).
CREATE OR REPLACE FUNCTION public.dedicated_agent_postings_sync_slots()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.dedicated_agent_posting_slots
       SET is_open = (NEW.status = 'open')
     WHERE posting_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS dedicated_agent_postings_sync_slots ON public.dedicated_agent_postings;
CREATE TRIGGER dedicated_agent_postings_sync_slots
  AFTER UPDATE OF status ON public.dedicated_agent_postings
  FOR EACH ROW EXECUTE FUNCTION public.dedicated_agent_postings_sync_slots();

-- 5. Applications (AC-A2/A3, B14/B15).
CREATE TABLE IF NOT EXISTS public.dedicated_agent_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id uuid NOT NULL REFERENCES public.dedicated_agent_postings(id) ON UPDATE CASCADE ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'applied',
  decided_by_user_id uuid REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  decided_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dedicated_agent_applications_posting_agent_key UNIQUE (posting_id, agent_id),
  CONSTRAINT dedicated_agent_applications_status_check CHECK (
    status IN ('applied', 'withdrawn', 'accepted', 'declined', 'auto_declined')
  )
);
CREATE INDEX IF NOT EXISTS dedicated_agent_applications_agent_idx ON public.dedicated_agent_applications (agent_id);
CREATE INDEX IF NOT EXISTS dedicated_agent_applications_pending_idx
  ON public.dedicated_agent_applications (posting_id) WHERE status = 'applied';

-- 6. Assignments (AC-S2, B7, A5, E2). Internal and independent agents (v5).
CREATE TABLE IF NOT EXISTS public.dedicated_agent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_location_id uuid NOT NULL REFERENCES public.business_locations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  slot_key text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL,
  posting_id uuid REFERENCES public.dedicated_agent_postings(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  application_id uuid REFERENCES public.dedicated_agent_applications(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  assigned_by_user_id uuid REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  off_today_date date,
  paused_at timestamptz,
  paused_by_user_id uuid REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  removed_at timestamptz,
  removed_by_user_id uuid REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  removed_reason text,
  relation_dismissed_at timestamptz,
  relation_dismissed_by_user_id uuid REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dedicated_agent_assignments_slot_key_check CHECK (slot_key IN ('morning', 'afternoon', 'evening')),
  CONSTRAINT dedicated_agent_assignments_status_check CHECK (status IN ('active', 'paused', 'removed')),
  CONSTRAINT dedicated_agent_assignments_source_check CHECK (source IN ('superuser_assign', 'posting')),
  CONSTRAINT dedicated_agent_assignments_posting_source_check CHECK (
    (source = 'posting') = (posting_id IS NOT NULL AND application_id IS NOT NULL)
  ),
  CONSTRAINT dedicated_agent_assignments_removed_check CHECK ((status = 'removed') = (removed_at IS NOT NULL)),
  CONSTRAINT dedicated_agent_assignments_paused_check CHECK (status <> 'paused' OR paused_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS dedicated_agent_assignments_live_unique_idx
  ON public.dedicated_agent_assignments (business_location_id, slot_key, agent_id)
  WHERE status IN ('active', 'paused');
CREATE INDEX IF NOT EXISTS dedicated_agent_assignments_coverage_idx
  ON public.dedicated_agent_assignments (business_location_id, slot_key) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS dedicated_agent_assignments_agent_idx
  ON public.dedicated_agent_assignments (agent_id) WHERE status IN ('active', 'paused');

-- Max live assignments per agent (D8).
-- Cap: same rule as the backend (resolveDedicatedAgentsConfig): the active row for the location's
-- country wins over the global row; a missing, non-integer or out-of-range (1..20) value means 3.
-- Concurrency: the agent row is locked FOR NO KEY UPDATE, which serialises concurrent assignment
-- writes for that agent without blocking FK readers (order_offers / orders.assigned_agent_id
-- writes take FOR KEY SHARE). The count then sees committed rows only under READ COMMITTED, which
-- is what Hasura runs (isolation_level: read-committed); under REPEATABLE READ / SERIALIZABLE the
-- snapshot predates the lock wait and the cap could be exceeded, so those levels are refused.
-- Writers touching several agents in one transaction must write them in agent_id order (see
-- orderAssignmentsForLocking in the backend) and may retry on 40P01.
CREATE OR REPLACE FUNCTION public.dedicated_agent_assignments_enforce_cap()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cap integer;
  raw numeric;
  location_country text;
  live integer;
BEGIN
  IF NEW.status NOT IN ('active', 'paused') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('active', 'paused') AND OLD.agent_id = NEW.agent_id THEN
    RETURN NEW;
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'dedicated_agent_assignment_requires_read_committed: assignment writes must run under READ COMMITTED (got %)',
      current_setting('transaction_isolation')
      USING ERRCODE = 'invalid_transaction_state';
  END IF;
  PERFORM 1 FROM public.agents WHERE id = NEW.agent_id FOR NO KEY UPDATE;
  SELECT NULLIF(upper(btrim(a.country)), '') INTO location_country
    FROM public.business_locations bl
    JOIN public.addresses a ON a.id = bl.address_id
   WHERE bl.id = NEW.business_location_id;
  SELECT c.number_value INTO raw
    FROM public.application_configurations c
   WHERE c.config_key = 'dedicated_max_assignments_per_agent'
     AND c.status = 'active'
     AND (NULLIF(btrim(c.country_code), '') IS NULL
          OR upper(btrim(c.country_code)) = location_country)
   ORDER BY (NULLIF(btrim(c.country_code), '') IS NULL)
   LIMIT 1;
  cap := CASE WHEN raw IS NOT NULL AND raw = trunc(raw) AND raw BETWEEN 1 AND 20 THEN raw::integer ELSE 3 END;
  SELECT count(*) INTO live
    FROM public.dedicated_agent_assignments
   WHERE agent_id = NEW.agent_id
     AND status IN ('active', 'paused')
     AND id <> NEW.id;
  IF live >= cap THEN
    RAISE EXCEPTION 'dedicated_agent_assignment_cap_exceeded: agent % already has % live assignments (max %)',
      NEW.agent_id, live, cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS dedicated_agent_assignments_enforce_cap ON public.dedicated_agent_assignments;
CREATE TRIGGER dedicated_agent_assignments_enforce_cap
  BEFORE INSERT OR UPDATE OF status, agent_id ON public.dedicated_agent_assignments
  FOR EACH ROW EXECUTE FUNCTION public.dedicated_agent_assignments_enforce_cap();

-- updated_at triggers (shared helper).
DROP TRIGGER IF EXISTS set_public_business_location_pickup_slots_updated_at ON public.business_location_pickup_slots;
CREATE TRIGGER set_public_business_location_pickup_slots_updated_at
  BEFORE UPDATE ON public.business_location_pickup_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
DROP TRIGGER IF EXISTS set_public_dedicated_agent_postings_updated_at ON public.dedicated_agent_postings;
CREATE TRIGGER set_public_dedicated_agent_postings_updated_at
  BEFORE UPDATE ON public.dedicated_agent_postings
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
DROP TRIGGER IF EXISTS set_public_dedicated_agent_applications_updated_at ON public.dedicated_agent_applications;
CREATE TRIGGER set_public_dedicated_agent_applications_updated_at
  BEFORE UPDATE ON public.dedicated_agent_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
DROP TRIGGER IF EXISTS set_public_dedicated_agent_assignments_updated_at ON public.dedicated_agent_assignments;
CREATE TRIGGER set_public_dedicated_agent_assignments_updated_at
  BEFORE UPDATE ON public.dedicated_agent_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 7. orders: coverage + assignment provenance (AC-E1, E3, A6b). Nullable, no defaults: metadata-only.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coverage_slot_key text,
  ADD COLUMN IF NOT EXISTS dedicated_assignment_id uuid,
  ADD COLUMN IF NOT EXISTS assignment_source text,
  ADD COLUMN IF NOT EXISTS dedicated_release_until timestamptz;
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_coverage_slot_key_check,
  DROP CONSTRAINT IF EXISTS orders_assignment_source_check,
  DROP CONSTRAINT IF EXISTS orders_dedicated_assignment_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_coverage_slot_key_check
    CHECK (coverage_slot_key IS NULL OR coverage_slot_key IN ('morning', 'afternoon', 'evening')) NOT VALID,
  ADD CONSTRAINT orders_assignment_source_check
    CHECK (assignment_source IS NULL OR assignment_source IN
      ('offer', 'open_claim', 'dedicated_offer', 'dedicated_auto', 'admin')) NOT VALID,
  ADD CONSTRAINT orders_dedicated_assignment_id_fkey
    FOREIGN KEY (dedicated_assignment_id) REFERENCES public.dedicated_agent_assignments(id)
    ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;

-- 8. order_offers: kind + decline reason (AC-A6, A7). Constant default: metadata-only on PG >= 11.
ALTER TABLE public.order_offers
  ADD COLUMN IF NOT EXISTS offer_kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS decline_reason text;
ALTER TABLE public.order_offers
  DROP CONSTRAINT IF EXISTS order_offers_offer_kind_check,
  DROP CONSTRAINT IF EXISTS order_offers_decline_reason_check;
ALTER TABLE public.order_offers
  ADD CONSTRAINT order_offers_offer_kind_check
    CHECK (offer_kind IN ('standard', 'dedicated')) NOT VALID,
  ADD CONSTRAINT order_offers_decline_reason_check
    CHECK (decline_reason IS NULL OR decline_reason IN ('too_far', 'busy', 'not_enough_balance', 'other')) NOT VALID;
