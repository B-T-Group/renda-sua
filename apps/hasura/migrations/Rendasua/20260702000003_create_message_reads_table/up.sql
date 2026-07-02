CREATE TABLE public.message_reads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES public.user_messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    read_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_message_reads_message_user UNIQUE (message_id, user_id)
);

CREATE INDEX idx_message_reads_message_id ON public.message_reads(message_id);
CREATE INDEX idx_message_reads_user_id ON public.message_reads(user_id);
