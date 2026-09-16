CREATE TYPE public.reel_comment_moderation_status AS ENUM (
  'visible', 'hidden', 'pending'
);

CREATE TABLE public.reel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_comment_id uuid NULL REFERENCES public.reel_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  moderation_status public.reel_comment_moderation_status NOT NULL DEFAULT 'visible',
  is_hidden boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  hidden_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reel_comments_reel_created_idx
  ON public.reel_comments (reel_id, created_at DESC);

ALTER TABLE public.reels
  ADD COLUMN comment_count integer NOT NULL DEFAULT 0 CHECK (comment_count >= 0);
