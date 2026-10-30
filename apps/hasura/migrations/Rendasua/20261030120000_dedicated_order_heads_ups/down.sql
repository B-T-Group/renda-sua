DELETE FROM public.message_types WHERE id = 'DEDICATED_ORDER_HEADS_UP'
  AND NOT EXISTS (SELECT 1 FROM public.user_messages WHERE message_type = 'DEDICATED_ORDER_HEADS_UP');
DROP TABLE IF EXISTS public.dedicated_order_heads_ups;
