-- Pickup failure reasons (business-initiated fail from ready_for_pickup)
CREATE TABLE public.pickup_failure_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reason_key VARCHAR(100) NOT NULL UNIQUE,
    reason_en VARCHAR(255) NOT NULL,
    reason_fr VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pickup_failure_reasons_is_active ON public.pickup_failure_reasons(is_active);
CREATE INDEX idx_pickup_failure_reasons_sort_order ON public.pickup_failure_reasons(sort_order);

CREATE TRIGGER set_public_pickup_failure_reasons_updated_at
    BEFORE UPDATE ON public.pickup_failure_reasons
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMENT ON TABLE public.pickup_failure_reasons IS
  'Predefined reasons for cooked-food failed pickups with bilingual support (EN/FR)';

INSERT INTO public.pickup_failure_reasons (reason_key, reason_en, reason_fr, sort_order) VALUES
('client_called_cancelled', 'Client called to cancel', 'Le client a appelé pour annuler', 1),
('client_no_show', 'Client no-show', 'Client absent', 2),
('payment_issues', 'Payment issues', 'Problèmes de paiement', 3),
('other', 'Other', 'Autre', 4);

-- Failed pickups tracking (1:1 with order)
CREATE TYPE public.failed_pickup_status_enum AS ENUM (
    'pending',
    'completed'
);

CREATE TABLE public.failed_pickups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    reason_id UUID NOT NULL REFERENCES public.pickup_failure_reasons(id) ON DELETE RESTRICT,
    notes TEXT,
    status public.failed_pickup_status_enum NOT NULL DEFAULT 'completed',
    refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    fee_retained NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL,
    fulfillment_method VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_failed_pickups_order_id ON public.failed_pickups(order_id);
CREATE INDEX idx_failed_pickups_business_id ON public.failed_pickups(business_id);
CREATE INDEX idx_failed_pickups_status ON public.failed_pickups(status);
CREATE INDEX idx_failed_pickups_reason_id ON public.failed_pickups(reason_id);

CREATE TRIGGER set_public_failed_pickups_updated_at
    BEFORE UPDATE ON public.failed_pickups
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMENT ON TABLE public.failed_pickups IS
  'Tracks business-initiated failed pickups for cooked food (ready_for_pickup) with partial refund amounts';

-- Client cancel-at-ready quick reasons for cooked food
INSERT INTO public.order_cancellation_reasons (id, value, display, rank, persona)
VALUES
  (22, 'wont_make_it', 'Won''t make it in time', 21, ARRAY['client']),
  (23, 'something_came_up', 'Something came up', 22, ARRAY['client']),
  (24, 'momo_payment_issues', 'Mobile money payment issues', 23, ARRAY['client'])
ON CONFLICT (id) DO NOTHING;
