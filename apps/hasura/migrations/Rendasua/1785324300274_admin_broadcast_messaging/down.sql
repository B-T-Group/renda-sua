DELETE FROM public.message_types
WHERE id IN ('ADMIN_BROADCAST', 'ADMIN_APP_UPGRADE', 'ADMIN_ACCOUNT_SETUP');

DELETE FROM public.entity_types WHERE id = 'admin_broadcast';

DROP TABLE IF EXISTS public.admin_broadcast_retargets;
DROP TABLE IF EXISTS public.admin_broadcast_campaigns;

DROP TYPE IF EXISTS public.admin_broadcast_action_type;
DROP TYPE IF EXISTS public.admin_broadcast_template_key;
DROP TYPE IF EXISTS public.admin_broadcast_audience_type;
DROP TYPE IF EXISTS public.admin_broadcast_campaign_status;
