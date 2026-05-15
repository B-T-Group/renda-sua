-- One Expo push token per user: keep the most recently registered row, then enforce uniqueness on user_id.

DELETE FROM public.mobile_push_tokens m
WHERE m.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY created_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM public.mobile_push_tokens
  ) ranked
  WHERE ranked.rn > 1
);

ALTER TABLE public.mobile_push_tokens
  DROP CONSTRAINT uq_mobile_push_tokens_user_token;

ALTER TABLE public.mobile_push_tokens
  ADD CONSTRAINT uq_mobile_push_tokens_user_id UNIQUE (user_id);

COMMENT ON TABLE public.mobile_push_tokens IS
  'Expo push token for native/mobile push (at most one active token per user; new registration replaces the previous)';
