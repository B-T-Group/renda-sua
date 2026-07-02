CREATE TABLE public.message_recipients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES public.user_messages(id) ON DELETE CASCADE,
    recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_type text NOT NULL,
    notified_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_recipient_type CHECK (recipient_type IN ('mentioned', 'default_route'))
);

CREATE INDEX idx_message_recipients_message_id ON public.message_recipients(message_id);
CREATE INDEX idx_message_recipients_recipient_user_id ON public.message_recipients(recipient_user_id);
