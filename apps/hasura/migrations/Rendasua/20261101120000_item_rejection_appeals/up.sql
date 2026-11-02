-- Rejected item recovery + appeals (spec: plans/rejected-item-recovery-appeal-ux-ac.md, B1-B4, B6).
-- Idempotent where Postgres allows it.

DO $$ BEGIN
  CREATE TYPE public.item_rejection_category AS ENUM (
    'photo_quality', 'prohibited_item', 'counterfeit', 'wrong_condition',
    'missing_info', 'pricing', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.item_condition AS ENUM ('new', 'used', 'refurbished');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.item_appeal_status AS ENUM ('pending', 'upheld', 'overturned', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- B2: one row per rejection (admin, AI, or AI-proposal force reject).
CREATE TABLE IF NOT EXISTS public.item_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  category public.item_rejection_category NOT NULL,
  reason text NOT NULL DEFAULT '',
  reviewer_id uuid NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'ai', 'backfill')),
  item_snapshot jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.item_rejections IS
  'B2: each sale-item rejection. reviewer_id NULL = AI. item_snapshot = fields/photos at rejection time (admin original-vs-current view).';
CREATE INDEX IF NOT EXISTS item_rejections_item_created_idx
  ON public.item_rejections (item_id, created_at DESC);

-- B1 / B3 columns on items.
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS rejection_category public.item_rejection_category NULL,
  ADD COLUMN IF NOT EXISTS current_rejection_id uuid NULL
    REFERENCES public.item_rejections(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condition public.item_condition NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS wear_note text NULL;

COMMENT ON COLUMN public.items.rejection_category IS
  'B1: set while moderation_status = rejected, cleared when the item leaves rejected.';
COMMENT ON COLUMN public.items.current_rejection_id IS
  'B2: latest item_rejections row (kept after resubmit for history/metrics).';
COMMENT ON COLUMN public.items.condition IS
  'B3: new | used | refurbished. is_used is kept in sync by trigger (used/refurbished -> true).';
COMMENT ON COLUMN public.items.wear_note IS
  'B3: 10-300 chars; required by the API unless condition = new.';

-- B3 backfill from is_used.
UPDATE public.items SET condition = 'used' WHERE is_used = true AND condition = 'new';

DO $$ BEGIN
  ALTER TABLE public.items ADD CONSTRAINT items_wear_note_length_chk
    CHECK (wear_note IS NULL OR char_length(btrim(wear_note)) BETWEEN 10 AND 300);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- B1 backfill: existing rejected rows -> category other, with a rejection record.
WITH rejected AS (
  SELECT i.id, i.moderated_by_user_id, i.moderation_source, i.moderated_at,
    COALESCE(
      (SELECT m.message FROM public.user_messages m
        WHERE m.entity_type = 'sale_item' AND m.entity_id = i.id
        ORDER BY m.created_at DESC LIMIT 1),
      (SELECT r.decision_reason FROM public.item_ai_reviews r
        WHERE r.item_id = i.id AND r.status = 'rejected'
        ORDER BY r.created_at DESC LIMIT 1),
      ''
    ) AS reason
  FROM public.items i
  WHERE i.moderation_status = 'rejected' AND i.current_rejection_id IS NULL
), ins AS (
  INSERT INTO public.item_rejections (item_id, category, reason, reviewer_id, source, created_at)
  SELECT id, 'other', reason,
    CASE WHEN moderation_source = 'ai' THEN NULL ELSE moderated_by_user_id END,
    'backfill', COALESCE(moderated_at, now())
  FROM rejected
  RETURNING id, item_id
)
UPDATE public.items i
SET rejection_category = 'other', current_rejection_id = ins.id
FROM ins WHERE ins.item_id = i.id;

DO $$ BEGIN
  ALTER TABLE public.items ADD CONSTRAINT items_rejected_requires_category_chk
    CHECK (moderation_status <> 'rejected' OR rejection_category IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- B4: appeals.
CREATE TABLE IF NOT EXISTS public.item_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rejection_id uuid NOT NULL REFERENCES public.item_rejections(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  submitted_by_user_id uuid NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 20 AND 500),
  evidence_urls text[] NOT NULL DEFAULT '{}' CHECK (cardinality(evidence_urls) <= 3),
  status public.item_appeal_status NOT NULL DEFAULT 'pending',
  admin_id uuid NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  admin_note text NULL CHECK (admin_note IS NULL OR char_length(admin_note) <= 2000),
  outcome_moderation_status text NULL CHECK (outcome_moderation_status IN ('approved', 'pending')),
  corrected_category public.item_rejection_category NULL,
  withdrawn_reason text NULL CHECK (withdrawn_reason IN ('resubmitted', 'item_deleted', 'business')),
  decided_at timestamptz NULL,
  sla_due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_appeals_upheld_needs_note_chk
    CHECK (status <> 'upheld' OR char_length(btrim(COALESCE(admin_note, ''))) > 0),
  CONSTRAINT item_appeals_decided_fields_chk
    CHECK ((status IN ('upheld', 'overturned')) = (decided_at IS NOT NULL AND admin_id IS NOT NULL))
);
COMMENT ON TABLE public.item_appeals IS
  'B4: business appeal of an item rejection. At most one pending appeal per rejection (index); '
  'total non-withdrawn appeals per rejection capped by app config item_appeal_limit_per_rejection (API).';
-- One open appeal per rejection; withdrawn rows never block.
CREATE UNIQUE INDEX IF NOT EXISTS item_appeals_one_pending_per_rejection
  ON public.item_appeals (rejection_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS item_appeals_queue_idx
  ON public.item_appeals (sla_due_at, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS item_appeals_item_idx ON public.item_appeals (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS item_appeals_business_idx ON public.item_appeals (business_id, created_at DESC);

-- B7 / A3 audit log (also feeds the admin item-history view).
CREATE TABLE IF NOT EXISTS public.item_moderation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  rejection_id uuid NULL REFERENCES public.item_rejections(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  appeal_id uuid NULL REFERENCES public.item_appeals(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  actor_user_id uuid NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS item_moderation_audit_item_idx
  ON public.item_moderation_audit (item_id, created_at DESC);

-- B3: keep is_used and condition in sync for legacy writers (CSV, Hasura inserts).
CREATE OR REPLACE FUNCTION public.items_sync_condition_is_used()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.condition <> 'new' THEN
      NEW.is_used := true;
    ELSIF NEW.is_used THEN
      NEW.condition := 'used';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.condition IS DISTINCT FROM OLD.condition THEN
    NEW.is_used := (NEW.condition <> 'new');
  ELSIF NEW.is_used IS DISTINCT FROM OLD.is_used THEN
    NEW.condition := CASE
      WHEN NOT NEW.is_used THEN 'new'::public.item_condition
      WHEN OLD.condition = 'refurbished' THEN 'refurbished'::public.item_condition
      ELSE 'used'::public.item_condition
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS items_sync_condition_is_used ON public.items;
CREATE TRIGGER items_sync_condition_is_used
  BEFORE INSERT OR UPDATE OF condition, is_used ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.items_sync_condition_is_used();

-- B1: category only lives while rejected.
CREATE OR REPLACE FUNCTION public.items_clear_rejection_category()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.moderation_status <> 'rejected' THEN
    NEW.rejection_category := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS items_clear_rejection_category ON public.items;
CREATE TRIGGER items_clear_rejection_category
  BEFORE UPDATE OF moderation_status ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.items_clear_rejection_category();

-- B6 + edge cases: resubmit (rejected -> pending/ai_reviewing) or soft delete
-- withdraws pending appeals on every write path (Nest, CSV, Hasura). No notification.
CREATE OR REPLACE FUNCTION public.items_withdraw_pending_appeals()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  why text;
BEGIN
  IF NEW.status = 'deleted' AND OLD.status IS DISTINCT FROM 'deleted' THEN
    why := 'item_deleted';
  ELSIF OLD.moderation_status = 'rejected'
        AND NEW.moderation_status IN ('pending', 'ai_reviewing') THEN
    why := 'resubmitted';
  ELSE
    RETURN NEW;
  END IF;
  UPDATE public.item_appeals
     SET status = 'withdrawn', withdrawn_reason = why, updated_at = now()
   WHERE item_id = NEW.id AND status = 'pending';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS items_withdraw_pending_appeals ON public.items;
CREATE TRIGGER items_withdraw_pending_appeals
  AFTER UPDATE OF moderation_status, status ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.items_withdraw_pending_appeals();

-- B4 config (global; per-market rows can be added later, country row wins).
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value, min_value, max_value,
  country_code, tags, status)
SELECT 'item_appeal_limit_per_rejection', 'Item appeals per rejection',
  'B4 default 1: non-withdrawn appeals a business may file per rejection.',
  'number', 1, 0, 5, NULL, ARRAY['moderation', 'appeals'], 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.application_configurations
  WHERE config_key = 'item_appeal_limit_per_rejection' AND country_code IS NULL);

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value, min_value, max_value,
  country_code, tags, status)
SELECT 'item_appeal_sla_hours', 'Item appeal review SLA (hours)',
  'Admin decision SLA for item appeals. Default 48 (amber at 75%). Frozen into sla_due_at at submit.',
  'number', 48, 1, 336, NULL, ARRAY['moderation', 'appeals'], 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.application_configurations
  WHERE config_key = 'item_appeal_sla_hours' AND country_code IS NULL);
