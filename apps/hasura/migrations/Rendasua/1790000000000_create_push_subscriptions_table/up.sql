-- Create push_subscriptions table for Web Push notifications
-- Stores browser push subscription details per user (multiple devices allowed)

CREATE TABLE public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_push_subscriptions_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE
);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

COMMENT ON TABLE public.push_subscriptions IS
    'Web Push subscription endpoints for sending browser push notifications';
COMMENT ON COLUMN public.push_subscriptions.user_id IS
    'Reference to the user who subscribed';
COMMENT ON COLUMN public.push_subscriptions.endpoint IS
    'Push service endpoint URL';
COMMENT ON COLUMN public.push_subscriptions.p256dh_key IS
    'Client public key for encryption (base64)';
COMMENT ON COLUMN public.push_subscriptions.auth_key IS
    'Authentication secret (base64)';
