DELETE FROM public.application_configurations
WHERE config_key IN (
  'pickup_sla_minutes',
  'pickup_reminder_minutes_before',
  'pickup_overdue_grace_minutes',
  'pickup_reassignment_grace_minutes',
  'pickup_extension_minutes',
  'pickup_geofence_meters',
  'pickup_approach_delta_meters',
  'pickup_gps_stale_minutes',
  'pickup_auto_reassignment_enabled',
  'pickup_max_reassignments'
);

ALTER TABLE public.agents
  DROP COLUMN IF EXISTS pickups_completed_count,
  DROP COLUMN IF EXISTS pickups_reassigned_count,
  DROP COLUMN IF EXISTS pickup_issues_reported_count,
  DROP COLUMN IF EXISTS pickup_reliability_score;

DROP INDEX IF EXISTS public.idx_order_events_type;
DROP INDEX IF EXISTS public.idx_order_events_order_id_created;
DROP TABLE IF EXISTS public.order_events;

DROP INDEX IF EXISTS public.idx_orders_pickup_reassign;
DROP INDEX IF EXISTS public.idx_orders_pickup_monitor;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS assigned_at,
  DROP COLUMN IF EXISTS pickup_due_at,
  DROP COLUMN IF EXISTS pickup_state,
  DROP COLUMN IF EXISTS pickup_reminder_sent_at,
  DROP COLUMN IF EXISTS pickup_at_risk_at,
  DROP COLUMN IF EXISTS pickup_overdue_at,
  DROP COLUMN IF EXISTS pickup_extension_minutes,
  DROP COLUMN IF EXISTS pickup_paused_at,
  DROP COLUMN IF EXISTS pickup_pause_reason,
  DROP COLUMN IF EXISTS pickup_pause_remaining_ms,
  DROP COLUMN IF EXISTS reassignment_count,
  DROP COLUMN IF EXISTS last_agent_distance_m,
  DROP COLUMN IF EXISTS last_agent_progress_at,
  DROP COLUMN IF EXISTS agent_arrived_pickup_at;

DROP TYPE IF EXISTS public.order_pickup_state;
