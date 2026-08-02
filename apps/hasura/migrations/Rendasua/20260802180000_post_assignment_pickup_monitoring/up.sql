-- Post-assignment pickup monitoring: SLA substate, order events, agent pickup reliability

CREATE TYPE public.order_pickup_state AS ENUM (
  'monitoring',
  'reminded',
  'at_risk',
  'overdue',
  'reassigning',
  'paused',
  'recovered'
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_state public.order_pickup_state,
  ADD COLUMN IF NOT EXISTS pickup_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_at_risk_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_overdue_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_extension_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_pause_reason text,
  ADD COLUMN IF NOT EXISTS pickup_pause_remaining_ms bigint,
  ADD COLUMN IF NOT EXISTS reassignment_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_agent_distance_m numeric(12, 2),
  ADD COLUMN IF NOT EXISTS last_agent_progress_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_arrived_pickup_at timestamptz;

COMMENT ON COLUMN public.orders.assigned_at IS 'When the current agent was assigned';
COMMENT ON COLUMN public.orders.pickup_due_at IS 'Operational pickup deadline (max of assigned_at+SLA, pickup_by)';
COMMENT ON COLUMN public.orders.pickup_state IS 'Pickup monitoring ladder substate while assigned_to_agent';
COMMENT ON COLUMN public.orders.pickup_extension_minutes IS 'Agent running-late extension minutes (once per assignment)';
COMMENT ON COLUMN public.orders.pickup_pause_reason IS 'merchant_delay | support_hold | agent_reported_merchant_delay';
COMMENT ON COLUMN public.orders.pickup_pause_remaining_ms IS 'Remaining ms until pickup_due_at when pause began';
COMMENT ON COLUMN public.orders.reassignment_count IS 'How many times this order has been system-reassigned';
COMMENT ON COLUMN public.orders.last_agent_distance_m IS 'Last measured distance from agent to pickup (meters)';
COMMENT ON COLUMN public.orders.agent_arrived_pickup_at IS 'When agent entered pickup geofence';

CREATE INDEX IF NOT EXISTS idx_orders_pickup_monitor
  ON public.orders (pickup_state, pickup_due_at)
  WHERE current_status = 'assigned_to_agent'
    AND pickup_state IS NOT NULL
    AND pickup_state <> 'paused';

CREATE INDEX IF NOT EXISTS idx_orders_pickup_reassign
  ON public.orders (pickup_overdue_at)
  WHERE current_status = 'assigned_to_agent'
    AND pickup_state = 'overdue';

CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.order_events IS 'Operational timeline events for orders (pickup SLA, reassignment, delays)';
COMMENT ON COLUMN public.order_events.actor_type IS 'client | business | agent | system | support';

CREATE INDEX IF NOT EXISTS idx_order_events_order_id_created
  ON public.order_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_events_type
  ON public.order_events (event_type);

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS pickups_completed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickups_reassigned_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_issues_reported_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_reliability_score numeric(6, 2) NOT NULL DEFAULT 100;

COMMENT ON COLUMN public.agents.pickups_completed_count IS 'Successful pickups completed by agent';
COMMENT ON COLUMN public.agents.pickups_reassigned_count IS 'Times agent was auto-reassigned for missed pickup';
COMMENT ON COLUMN public.agents.pickup_issues_reported_count IS 'Honest issue reports (no reliability penalty)';
COMMENT ON COLUMN public.agents.pickup_reliability_score IS '0-100 score for pickup reliability';

INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  number_value,
  country_code,
  status,
  version,
  tags
) VALUES
(
  'pickup_sla_minutes',
  'Pickup SLA Minutes',
  'Default minutes after assignment for ASAP pickup deadline',
  'number',
  20,
  NULL,
  'active',
  1,
  ARRAY['order', 'pickup', 'sla']
),
(
  'pickup_reminder_minutes_before',
  'Pickup Reminder Minutes Before Due',
  'Minutes before pickup_due_at to send agent reminder',
  'number',
  5,
  NULL,
  'active',
  1,
  ARRAY['order', 'pickup', 'sla']
),
(
  'pickup_overdue_grace_minutes',
  'Pickup Overdue Grace Minutes',
  'Minutes after pickup_due_at before marking overdue',
  'number',
  10,
  NULL,
  'active',
  1,
  ARRAY['order', 'pickup', 'sla']
),
(
  'pickup_reassignment_grace_minutes',
  'Pickup Reassignment Grace Minutes',
  'Minutes after pickup_due_at before eligible for reassignment',
  'number',
  20,
  NULL,
  'active',
  1,
  ARRAY['order', 'pickup', 'sla']
),
(
  'pickup_extension_minutes',
  'Pickup Running Late Extension Minutes',
  'Minutes added when agent taps Running late (once per assignment)',
  'number',
  10,
  NULL,
  'active',
  1,
  ARRAY['order', 'pickup', 'sla']
),
(
  'pickup_geofence_meters',
  'Pickup Geofence Meters',
  'Distance in meters to consider agent arrived at pickup',
  'number',
  150,
  NULL,
  'active',
  1,
  ARRAY['order', 'pickup', 'gps']
),
(
  'pickup_approach_delta_meters',
  'Pickup Approach Delta Meters',
  'Minimum distance reduction to count as approaching pickup',
  'number',
  150,
  NULL,
  'active',
  1,
  ARRAY['order', 'pickup', 'gps']
),
(
  'pickup_gps_stale_minutes',
  'Pickup GPS Stale Minutes',
  'Agent location older than this is treated as GPS unavailable',
  'number',
  10,
  NULL,
  'active',
  1,
  ARRAY['order', 'pickup', 'gps']
),
(
  'pickup_auto_reassignment_enabled',
  'Pickup Auto Reassignment Enabled',
  'When 1, overdue assignments may be automatically reassigned',
  'number',
  0,
  NULL,
  'active',
  1,
  ARRAY['order', 'pickup', 'reassignment']
),
(
  'pickup_max_reassignments',
  'Pickup Max Reassignments',
  'Max automatic reassignments before support escalation',
  'number',
  2,
  NULL,
  'active',
  1,
  ARRAY['order', 'pickup', 'reassignment']
)
;
