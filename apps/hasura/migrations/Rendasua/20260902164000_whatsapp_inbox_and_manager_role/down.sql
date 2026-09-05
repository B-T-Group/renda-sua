DELETE FROM public.role_permissions
WHERE role_id IN (SELECT id FROM public.roles WHERE key = 'whatsapp_manager')
  AND permission_id IN (
    SELECT id FROM public.permissions WHERE key = 'platform.ops.whatsapp_inbox'
  );

DELETE FROM public.user_roles
WHERE role_id IN (SELECT id FROM public.roles WHERE key = 'whatsapp_manager');

DELETE FROM public.roles WHERE key = 'whatsapp_manager';
DELETE FROM public.permissions WHERE key = 'platform.ops.whatsapp_inbox';

DROP TABLE IF EXISTS public.whatsapp_messages;
DROP TABLE IF EXISTS public.whatsapp_conversations;
