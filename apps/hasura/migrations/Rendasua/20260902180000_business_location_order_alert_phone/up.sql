-- Kitchen / till WhatsApp or SMS number for new-order alerts (separate from contact/MoMo phone).
ALTER TABLE public.business_locations
  ADD COLUMN IF NOT EXISTS order_alert_phone text;

COMMENT ON COLUMN public.business_locations.order_alert_phone IS
  'E.164 mobile for kitchen WhatsApp/SMS new-order alerts; not the contact or MoMo phone.';
