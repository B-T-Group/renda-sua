-- Create mobile_push_tokens table for Expo (native/mobile) push notifications
-- Stores Expo push tokens per user (multiple devices allowed)

CREATE TABLE public.mobile_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    expo_push_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_mobile_push_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT uq_mobile_push_tokens_user_token
        UNIQUE (user_id, expo_push_token)
);

CREATE INDEX idx_mobile_push_tokens_user_id ON public.mobile_push_tokens(user_id);

COMMENT ON TABLE public.mobile_push_tokens IS
    'Expo push tokens for sending native/mobile push notifications';
COMMENT ON COLUMN public.mobile_push_tokens.user_id IS
    'Reference to the user who registered the token';
COMMENT ON COLUMN public.mobile_push_tokens.expo_push_token IS
    'Expo push token (ExponentPushToken[...])';
