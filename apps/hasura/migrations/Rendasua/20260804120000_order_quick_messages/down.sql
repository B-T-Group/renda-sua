DELETE FROM public.message_types WHERE id = 'QUICK_MESSAGE';

DROP INDEX IF EXISTS public.message_mentions_message_user_key;

-- Restore single-mention constraint only when no message has multiple mentions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.message_mentions
    GROUP BY message_id
    HAVING COUNT(*) > 1
  ) THEN
    ALTER TABLE public.message_mentions
      ADD CONSTRAINT message_mentions_message_id_key UNIQUE (message_id);
  END IF;
END $$;
