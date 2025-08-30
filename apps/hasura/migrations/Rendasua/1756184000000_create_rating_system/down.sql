-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_update_rating_aggregates ON public.ratings;
DROP TRIGGER IF EXISTS set_public_rating_aggregates_updated_at ON public.rating_aggregates;
DROP TRIGGER IF EXISTS set_public_ratings_updated_at ON public.ratings;

-- Drop functions
DROP FUNCTION IF EXISTS update_rating_aggregates();
DROP FUNCTION IF EXISTS validate_rating_permission(UUID, rating_type_enum);
DROP FUNCTION IF EXISTS get_user_type(UUID);

-- Drop tables
DROP TABLE IF EXISTS public.rating_aggregates;
DROP TABLE IF EXISTS public.ratings;

-- Drop enum
DROP TYPE IF EXISTS public.rating_type_enum;
