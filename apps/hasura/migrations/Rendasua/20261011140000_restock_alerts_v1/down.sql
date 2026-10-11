-- Rollback: Restock alerts V1

-- Remove user preference columns
ALTER TABLE user_notification_preferences
DROP COLUMN IF EXISTS restock_alerts_push_enabled,
DROP COLUMN IF EXISTS restock_alerts_whatsapp_enabled,
DROP COLUMN IF EXISTS restock_alerts_sms_enabled;

-- Remove business_inventory column
DROP INDEX IF EXISTS idx_business_inventory_last_restocked;
ALTER TABLE business_inventory DROP COLUMN IF EXISTS last_restocked_at;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS restock_alert_sends;
DROP TABLE IF EXISTS restock_events;
DROP TABLE IF EXISTS restock_alerts;

-- Drop enum
DROP TYPE IF EXISTS restock_alert_status;

-- Remove feature flag
DELETE FROM application_configurations 
WHERE key = 'restock_alerts_v1' AND country_code IS NULL;
