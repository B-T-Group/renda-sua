-- Create business_account_types enum table
CREATE TABLE public.business_account_types (
    id   text PRIMARY KEY,
    comment text NOT NULL
);

-- Seed plan rows
INSERT INTO public.business_account_types (id, comment) VALUES
    ('STANDARD', 'Standard — 12% commission'),
    ('PREMIUM',  'Premium — 15% commission'),
    ('ELITE',    'Elite — 20% commission');

-- Add account_type column to businesses (default STANDARD)
ALTER TABLE public.businesses
    ADD COLUMN account_type text NOT NULL DEFAULT 'STANDARD'
        REFERENCES public.business_account_types(id);

-- Add lock-in column: NULL = can change now; non-null = locked until this timestamp
ALTER TABLE public.businesses
    ADD COLUMN account_type_locked_until timestamptz NULL;

-- Migrate all existing businesses to STANDARD (lock_until stays NULL so they can change immediately)
UPDATE public.businesses SET account_type = 'STANDARD';

-- Create audit/history table for all account-type changes
CREATE TABLE public.business_account_type_history (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id         uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    from_account_type   text        NULL REFERENCES public.business_account_types(id),
    to_account_type     text        NOT NULL REFERENCES public.business_account_types(id),
    changed_by_user_id  uuid        NULL REFERENCES public.users(id),
    change_source       text        NOT NULL,  -- 'self_serve' | 'admin'
    reason              text        NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_business_account_type_history_business_id
    ON public.business_account_type_history (business_id);

-- Mark business_locations.rendasua_item_commission_percentage as deprecated
COMMENT ON COLUMN public.business_locations.rendasua_item_commission_percentage
    IS 'DEPRECATED: commission is now derived from businesses.account_type. This column is read-only and will be removed in a future migration.';
