-- Restock alerts for liked items (#343, v1). Everything is behind restock_alerts_v1 (default false).
-- Additive only: new tables, new nullable-free columns with constant defaults (metadata-only on PG >= 11),
-- no rewrite of business_inventory, and no index predicates that use now().

-- 1. Flags (global rows; country rows may override). Never a blind insert.
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'restock_alerts_v1',
  'Restock alerts v1',
  'Master switch for restock alerts on liked items (event trigger consumer, cron, API). Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['restock', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'restock_alerts_v1' AND country_code IS NULL
);

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'restock_alerts_whatsapp_template_approved',
  'Restock alerts WhatsApp template approved',
  'Set true only after Meta approves template rs_restock_alert (en + fr). Until then WhatsApp is never used for restock alerts.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['restock', 'whatsapp', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'restock_alerts_whatsapp_template_approved' AND country_code IS NULL
);

-- Single-run lock for the restock cron: date_value = expiry, epoch = free (config_value_not_null forbids NULL).
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, date_value,
  country_code, status, version, tags
)
SELECT
  'restock_alerts_cron_lock',
  'Restock alerts cron lock',
  'Compare-and-set lock for the restock alerts processor. date_value = expiry, epoch = free. Managed by the backend; do not edit.',
  'date', '1970-01-01T00:00:00Z'::timestamptz, NULL, 'active', 1,
  ARRAY['restock', 'cron', 'lock']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'restock_alerts_cron_lock' AND country_code IS NULL
);

-- 2. Per-(user, item) alert state. One row per user-item (unique), consumed per 0 -> >=1 transition.
CREATE TABLE IF NOT EXISTS public.restock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE,
  alert_enabled boolean NOT NULL DEFAULT true,
  state text NOT NULL DEFAULT 'armed',
  disarm_reason text,
  armed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  last_alert_at timestamptz,
  last_event_id uuid,
  sent_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restock_alerts_user_item_key UNIQUE (user_id, item_id),
  CONSTRAINT restock_alerts_state_check CHECK (state IN ('armed', 'sent', 'disarmed')),
  CONSTRAINT restock_alerts_disarm_reason_check CHECK (
    disarm_reason IS NULL OR disarm_reason IN ('unlike', 'bought', 'expired', 'user_off')
  )
);
CREATE INDEX IF NOT EXISTS restock_alerts_item_state_idx ON public.restock_alerts (item_id, state);
CREATE INDEX IF NOT EXISTS restock_alerts_user_idx ON public.restock_alerts (user_id);

-- 3. Restock events written by the business_inventory trigger (single emit point, every writer).
CREATE TABLE IF NOT EXISTS public.restock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES public.business_inventory(id) ON UPDATE CASCADE ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE,
  business_location_id uuid NOT NULL REFERENCES public.business_locations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  available_quantity integer NOT NULL,
  out_of_stock_since timestamptz,
  status text NOT NULL DEFAULT 'pending',
  status_note text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restock_events_status_check CHECK (
    status IN ('pending', 'fanned_out', 'cancelled', 'superseded', 'suppressed')
  )
);
CREATE INDEX IF NOT EXISTS restock_events_pending_idx ON public.restock_events (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS restock_events_item_idx ON public.restock_events (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS restock_events_inventory_idx ON public.restock_events (inventory_id);
CREATE INDEX IF NOT EXISTS restock_events_location_idx ON public.restock_events (business_location_id);

-- 4. Per-item fan-out log (6 h cap). One row per event that fanned out.
CREATE TABLE IF NOT EXISTS public.restock_item_fanouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.restock_events(id) ON UPDATE CASCADE ON DELETE CASCADE,
  recipients integer NOT NULL DEFAULT 0,
  fanned_out_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restock_item_fanouts_event_key UNIQUE (event_id)
);
CREATE INDEX IF NOT EXISTS restock_item_fanouts_item_idx ON public.restock_item_fanouts (item_id, fanned_out_at DESC);

-- 5. Send log. idempotency_key is unique: one send per (event, user); digests share digest_key.
CREATE TABLE IF NOT EXISTS public.restock_alert_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.restock_events(id) ON UPDATE CASCADE ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  suppress_reason text,
  channel text,
  is_digest boolean NOT NULL DEFAULT false,
  digest_key text,
  digest_item_count integer,
  quantity_shown integer,
  attempts integer NOT NULL DEFAULT 0,
  not_before timestamptz NOT NULL DEFAULT now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restock_alert_sends_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT restock_alert_sends_status_check CHECK (
    status IN ('queued', 'sending', 'sent', 'failed', 'suppressed', 'dropped')
  ),
  CONSTRAINT restock_alert_sends_channel_check CHECK (
    channel IS NULL OR channel IN ('push', 'whatsapp', 'sms')
  )
);
CREATE INDEX IF NOT EXISTS restock_alert_sends_queue_idx ON public.restock_alert_sends (not_before) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS restock_alert_sends_sending_idx ON public.restock_alert_sends (updated_at) WHERE status = 'sending';
CREATE INDEX IF NOT EXISTS restock_alert_sends_user_sent_idx ON public.restock_alert_sends (user_id, sent_at DESC) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS restock_alert_sends_event_idx ON public.restock_alert_sends (event_id);
CREATE INDEX IF NOT EXISTS restock_alert_sends_item_idx ON public.restock_alert_sends (item_id);

-- 6. Preferences: push on, WhatsApp and SMS off by default for this category.
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS restock_alerts_push_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS restock_alerts_whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restock_alerts_sms_enabled boolean NOT NULL DEFAULT false;

-- 7. Helpers.
CREATE OR REPLACE FUNCTION public.restock_alerts_flag_on()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.application_configurations
    WHERE config_key = 'restock_alerts_v1' AND status = 'active' AND boolean_value IS TRUE
  );
$$;

-- Sellable available units for one inventory row: quantity - reserved, 0 when the row is inactive,
-- and for variant rows only when one sale of the option is possible (same rule as inventory_can_sell_one).
CREATE OR REPLACE FUNCTION public.restock_available_quantity(
  p_quantity integer, p_reserved integer, p_active boolean, p_variant_id uuid
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_active IS NOT TRUE THEN 0
    WHEN GREATEST(COALESCE(p_quantity, 0) - COALESCE(p_reserved, 0), 0) < 1 THEN 0
    WHEN p_variant_id IS NULL THEN GREATEST(COALESCE(p_quantity, 0) - COALESCE(p_reserved, 0), 0)
    WHEN EXISTS (
      SELECT 1 FROM public.item_variants iv
      WHERE iv.id = p_variant_id
        AND iv.is_active IS DISTINCT FROM false
        AND (COALESCE(p_quantity, 0) - COALESCE(p_reserved, 0)) >= COALESCE(iv.quantity, 1)
    ) THEN GREATEST(COALESCE(p_quantity, 0) - COALESCE(p_reserved, 0), 0)
    ELSE 0
  END;
$$;

-- 8. AC-0 single emit point. BEFORE trigger stamps last_restocked_at on every 0 -> >=1 transition
--    (any writer: Nest, Python lambdas, try_release_business_inventory, imports, manual SQL).
CREATE OR REPLACE FUNCTION public.business_inventory_stamp_restock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old integer := 0;
  v_new integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old := public.restock_available_quantity(OLD.quantity, OLD.reserved_quantity, OLD.is_active, OLD.item_variant_id);
  END IF;
  v_new := public.restock_available_quantity(NEW.quantity, NEW.reserved_quantity, NEW.is_active, NEW.item_variant_id);
  IF v_old <= 0 AND v_new >= 1 THEN
    NEW.last_restocked_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- AFTER trigger writes the event row (the FK needs the inventory row to exist, also on INSERT).
-- Never blocks the inventory write: any failure is downgraded to a WARNING.
CREATE OR REPLACE FUNCTION public.business_inventory_emit_restock_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old integer := 0;
  v_new integer;
  v_since timestamptz := NULL;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old := public.restock_available_quantity(OLD.quantity, OLD.reserved_quantity, OLD.is_active, OLD.item_variant_id);
    v_since := OLD.updated_at;
  END IF;
  v_new := public.restock_available_quantity(NEW.quantity, NEW.reserved_quantity, NEW.is_active, NEW.item_variant_id);
  IF NOT (v_old <= 0 AND v_new >= 1) THEN
    RETURN NEW;
  END IF;
  BEGIN
    IF public.restock_alerts_flag_on() AND EXISTS (
      SELECT 1
      FROM public.items i
      JOIN public.business_locations bl ON bl.id = NEW.business_location_id
      WHERE i.id = NEW.item_id
        AND i.is_active IS TRUE
        AND i.status = 'active'
        AND i.moderation_status = 'approved'
        AND bl.is_active IS TRUE
    ) THEN
      INSERT INTO public.restock_events (inventory_id, item_id, business_location_id, available_quantity, out_of_stock_since)
      VALUES (NEW.id, NEW.item_id, NEW.business_location_id, v_new, v_since);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'restock event not recorded for inventory %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_inventory_stamp_restock ON public.business_inventory;
CREATE TRIGGER business_inventory_stamp_restock
  BEFORE INSERT OR UPDATE OF quantity, reserved_quantity, is_active, item_variant_id ON public.business_inventory
  FOR EACH ROW EXECUTE FUNCTION public.business_inventory_stamp_restock();

DROP TRIGGER IF EXISTS business_inventory_emit_restock_event ON public.business_inventory;
CREATE TRIGGER business_inventory_emit_restock_event
  AFTER INSERT OR UPDATE OF quantity, reserved_quantity, is_active, item_variant_id ON public.business_inventory
  FOR EACH ROW EXECUTE FUNCTION public.business_inventory_emit_restock_event();

-- 9. Like / unlike / purchase keep alert state in step (DB level, covers every code path).
CREATE OR REPLACE FUNCTION public.restock_alerts_on_like()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    IF public.restock_alerts_flag_on() THEN
      INSERT INTO public.restock_alerts (user_id, item_id)
      VALUES (NEW.user_id, NEW.item_id)
      ON CONFLICT ON CONSTRAINT restock_alerts_user_item_key DO UPDATE
        SET state = 'armed', disarm_reason = NULL, alert_enabled = true,
            armed_at = now(), expires_at = now() + interval '90 days', updated_at = now();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'restock alert not armed on like: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restock_alerts_on_unlike()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    UPDATE public.restock_alerts
       SET state = 'disarmed', disarm_reason = 'unlike', updated_at = now()
     WHERE user_id = OLD.user_id AND item_id = OLD.item_id AND state <> 'disarmed';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'restock alert not disarmed on unlike: %', SQLERRM;
  END;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.restock_alerts_on_order_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_user uuid;
BEGIN
  BEGIN
    IF NEW.item_id IS NULL THEN
      RETURN NEW;
    END IF;
    SELECT c.user_id INTO v_user
      FROM public.orders o JOIN public.clients c ON c.id = o.client_id
     WHERE o.id = NEW.order_id;
    IF v_user IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_item_likes l WHERE l.user_id = v_user AND l.item_id = NEW.item_id
    ) THEN
      INSERT INTO public.restock_alerts (user_id, item_id, state, disarm_reason)
      VALUES (v_user, NEW.item_id, 'disarmed', 'bought')
      ON CONFLICT ON CONSTRAINT restock_alerts_user_item_key DO UPDATE
        SET state = 'disarmed', disarm_reason = 'bought', updated_at = now();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'restock alert not disarmed on purchase: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restock_alerts_on_like ON public.user_item_likes;
CREATE TRIGGER restock_alerts_on_like
  AFTER INSERT ON public.user_item_likes
  FOR EACH ROW EXECUTE FUNCTION public.restock_alerts_on_like();

DROP TRIGGER IF EXISTS restock_alerts_on_unlike ON public.user_item_likes;
CREATE TRIGGER restock_alerts_on_unlike
  AFTER DELETE ON public.user_item_likes
  FOR EACH ROW EXECUTE FUNCTION public.restock_alerts_on_unlike();

DROP TRIGGER IF EXISTS restock_alerts_on_order_item ON public.order_items;
CREATE TRIGGER restock_alerts_on_order_item
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.restock_alerts_on_order_item();

COMMENT ON TABLE public.restock_alerts IS 'Restock alert state per (user, item); rows exist only for liked items. Behind restock_alerts_v1.';
COMMENT ON TABLE public.restock_events IS 'Written by business_inventory trigger when available qty goes <=0 -> >=1. Processed by the restock cron.';
