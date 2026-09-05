-- Default WhatsApp on for users with a phone who never opted in (and never opted out).
-- Do not flip rows that already have whatsapp_opted_in_at — those users chose on or off.
INSERT INTO public.user_notification_preferences (
  user_id,
  whatsapp_enabled,
  whatsapp_opted_in_at
)
SELECT
  u.id,
  true,
  now()
FROM public.users u
WHERE NULLIF(btrim(u.phone_number), '') IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET
  whatsapp_enabled = true,
  whatsapp_opted_in_at = now(),
  updated_at = now()
WHERE public.user_notification_preferences.whatsapp_enabled IS DISTINCT FROM true
  AND public.user_notification_preferences.whatsapp_opted_in_at IS NULL;
