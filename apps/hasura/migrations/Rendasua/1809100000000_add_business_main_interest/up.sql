CREATE TYPE public.business_main_interest_enum AS ENUM (
    'sell_items',
    'rent_items'
);

ALTER TABLE public.businesses
ADD COLUMN main_interest public.business_main_interest_enum NOT NULL DEFAULT 'sell_items';

COMMENT ON COLUMN public.businesses.main_interest IS 'Primary commercial focus: retail sales vs. rentals; shapes business dashboard defaults.';
