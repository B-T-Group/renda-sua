CREATE TABLE public.message_mentions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL UNIQUE REFERENCES public.user_messages(id) ON DELETE CASCADE,
    mentioned_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mentioned_persona text NOT NULL,
    text_offset int NULL,
    text_length int NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_mentioned_persona CHECK (mentioned_persona IN ('client', 'agent', 'business'))
);

CREATE INDEX idx_message_mentions_message_id ON public.message_mentions(message_id);
CREATE INDEX idx_message_mentions_mentioned_user_id ON public.message_mentions(mentioned_user_id);
