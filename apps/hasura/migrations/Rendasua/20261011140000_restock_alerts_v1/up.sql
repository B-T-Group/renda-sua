-- Migration: Restock alerts V1
-- Add feature flag and tracking tables for restock alerts on liked items

-- 1. Add feature flag (with WHERE NOT EXISTS to avoid conflicts)
INSERT INTO application_configurations (key, value_json, country_code)
SELECT 'restock_alerts_v1', 'false'::jsonb, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM application_configurations 
  WHERE key = 'restock_alerts_v1' AND country_code IS NULL
);

-- 2. Create enum for alert states
CREATE TYPE restock_alert_status AS ENUM ('armed', 'sent', 'disarmed_unlike', 'disarmed_purchased', 'disarmed_expired');

-- 3. Create table to track restock alert states
CREATE TABLE restock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL,
  status restock_alert_status NOT NULL DEFAULT 'armed',
  alert_enabled boolean NOT NULL DEFAULT true,
  
  -- Tracking fields
  armed_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  disarmed_at timestamptz,
  disarm_reason text,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE (user_id, item_id)
);

-- 4. Create indexes for efficient queries
CREATE INDEX idx_restock_alerts_user_item ON restock_alerts(user_id, item_id);
CREATE INDEX idx_restock_alerts_status ON restock_alerts(status);
CREATE INDEX idx_restock_alerts_armed_at ON restock_alerts(armed_at) WHERE status = 'armed';
CREATE INDEX idx_restock_alerts_item_armed ON restock_alerts(item_id, status) WHERE status = 'armed';
CREATE INDEX idx_restock_alerts_last_sent ON restock_alerts(last_sent_at) WHERE last_sent_at IS NOT NULL;

-- 5. Create table for tracking restock events (for debounce and rate limiting)
CREATE TABLE restock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES business_inventory(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  business_location_id uuid NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  
  -- Stock info at event time
  available_quantity integer NOT NULL,
  total_quantity integer NOT NULL,
  reserved_quantity integer NOT NULL DEFAULT 0,
  
  -- Event metadata
  event_type text NOT NULL DEFAULT 'restocked',
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- For tracking if this event has been processed
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  alerts_sent_count integer NOT NULL DEFAULT 0
);

-- 6. Indexes for restock events
CREATE INDEX idx_restock_events_inventory ON restock_events(inventory_id);
CREATE INDEX idx_restock_events_item ON restock_events(item_id);
CREATE INDEX idx_restock_events_created ON restock_events(created_at DESC);
CREATE INDEX idx_restock_events_unprocessed ON restock_events(processed) WHERE NOT processed;

-- 7. Create table for tracking alert sends (for rate limiting and digest)
CREATE TABLE restock_alert_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  restock_event_id uuid REFERENCES restock_events(id) ON DELETE SET NULL,
  
  -- Send details
  channel text NOT NULL,
  is_digest boolean NOT NULL DEFAULT false,
  digest_item_count integer,
  quantity_shown integer,
  
  -- Status tracking
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Indexes for alert sends (for rate limiting queries)
CREATE INDEX idx_restock_alert_sends_user_sent ON restock_alert_sends(user_id, sent_at DESC);
CREATE INDEX idx_restock_alert_sends_item_sent ON restock_alert_sends(item_id, sent_at DESC) WHERE item_id IS NOT NULL;
CREATE INDEX idx_restock_alert_sends_24h ON restock_alert_sends(user_id, sent_at) WHERE sent_at > now() - interval '24 hours';

-- 9. Add column to business_inventory for tracking last restock time
ALTER TABLE business_inventory 
ADD COLUMN IF NOT EXISTS last_restocked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_business_inventory_last_restocked 
ON business_inventory(last_restocked_at) WHERE last_restocked_at IS NOT NULL;

-- 10. Add user preference columns for restock alerts
ALTER TABLE user_notification_preferences
ADD COLUMN IF NOT EXISTS restock_alerts_push_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS restock_alerts_whatsapp_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS restock_alerts_sms_enabled boolean NOT NULL DEFAULT false;

-- 11. Grant permissions (adjust roles as needed)
-- Hasura will need to read/write these tables
