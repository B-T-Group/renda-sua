-- Create rating_type enum
CREATE TYPE public.rating_type_enum AS ENUM (
    'client_to_agent',    -- Client rating agent
    'client_to_item',     -- Client rating item
    'agent_to_client'     -- Agent rating client
);

-- Create ratings table
CREATE TABLE public.ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Rating context
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rating_type rating_type_enum NOT NULL,
    
    -- Who is giving the rating (rater_type inferred from user profile)
    rater_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Who/what is being rated
    rated_entity_type VARCHAR(20) NOT NULL CHECK (rated_entity_type IN ('agent', 'client', 'item')),
    rated_entity_id UUID NOT NULL, -- References agents.id, clients.id, or items.id
    
    -- Rating details
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    -- Metadata
    is_public BOOLEAN DEFAULT TRUE, -- Whether the rating is visible to others
    is_verified BOOLEAN DEFAULT FALSE, -- Whether the rating is from a verified order
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_rating_per_order UNIQUE (order_id, rating_type, rater_user_id),
    CONSTRAINT valid_rating_combination CHECK (
        (rating_type = 'client_to_agent' AND rated_entity_type = 'agent') OR
        (rating_type = 'client_to_item' AND rated_entity_type = 'item') OR
        (rating_type = 'agent_to_client' AND rated_entity_type = 'client')
    )
);

-- Create indexes for better performance
CREATE INDEX idx_ratings_order_id ON public.ratings(order_id);
CREATE INDEX idx_ratings_rating_type ON public.ratings(rating_type);
CREATE INDEX idx_ratings_rater_user_id ON public.ratings(rater_user_id);
CREATE INDEX idx_ratings_rated_entity ON public.ratings(rated_entity_type, rated_entity_id);
CREATE INDEX idx_ratings_created_at ON public.ratings(created_at);
CREATE INDEX idx_ratings_verified ON public.ratings(is_verified) WHERE is_verified = TRUE;

-- Create trigger for updated_at column
CREATE TRIGGER set_public_ratings_updated_at
    BEFORE UPDATE ON public.ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Create rating_aggregates table for caching average ratings
CREATE TABLE public.rating_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity being rated
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('agent', 'client', 'item')),
    entity_id UUID NOT NULL,
    
    -- Aggregated statistics
    total_ratings INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2) NOT NULL DEFAULT 0,
    rating_1_count INTEGER NOT NULL DEFAULT 0,
    rating_2_count INTEGER NOT NULL DEFAULT 0,
    rating_3_count INTEGER NOT NULL DEFAULT 0,
    rating_4_count INTEGER NOT NULL DEFAULT 0,
    rating_5_count INTEGER NOT NULL DEFAULT 0,
    
    -- Last updated
    last_rating_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_entity_aggregate UNIQUE (entity_type, entity_id),
    CONSTRAINT valid_average_rating CHECK (average_rating >= 0 AND average_rating <= 5),
    CONSTRAINT valid_total_ratings CHECK (total_ratings >= 0)
);

-- Create indexes
CREATE INDEX idx_rating_aggregates_entity ON public.rating_aggregates(entity_type, entity_id);
CREATE INDEX idx_rating_aggregates_average ON public.rating_aggregates(average_rating);

-- Create trigger for updated_at column
CREATE TRIGGER set_public_rating_aggregates_updated_at
    BEFORE UPDATE ON public.rating_aggregates
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Function to get user type from user profile
CREATE OR REPLACE FUNCTION get_user_type(user_uuid UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    user_type VARCHAR(20);
BEGIN
    SELECT user_type_id INTO user_type
    FROM public.users
    WHERE id = user_uuid;
    
    RETURN user_type;
END;
$$ LANGUAGE plpgsql;

-- Function to validate rating permissions
CREATE OR REPLACE FUNCTION validate_rating_permission(
    p_rater_user_id UUID,
    p_rating_type rating_type_enum
)
RETURNS BOOLEAN AS $$
DECLARE
    user_type VARCHAR(20);
BEGIN
    -- Get user type
    user_type := get_user_type(p_rater_user_id);
    
    -- Validate based on rating type
    RETURN (
        (p_rating_type = 'client_to_agent' AND user_type = 'client') OR
        (p_rating_type = 'client_to_item' AND user_type = 'client') OR
        (p_rating_type = 'agent_to_client' AND user_type = 'agent')
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update rating aggregates when a new rating is added
CREATE OR REPLACE FUNCTION update_rating_aggregates()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update the aggregate record
    INSERT INTO public.rating_aggregates (
        entity_type,
        entity_id,
        total_ratings,
        average_rating,
        rating_1_count,
        rating_2_count,
        rating_3_count,
        rating_4_count,
        rating_5_count,
        last_rating_at
    )
    SELECT 
        rated_entity_type,
        rated_entity_id,
        COUNT(*) as total_ratings,
        ROUND(AVG(rating)::numeric, 2) as average_rating,
        COUNT(*) FILTER (WHERE rating = 1) as rating_1_count,
        COUNT(*) FILTER (WHERE rating = 2) as rating_2_count,
        COUNT(*) FILTER (WHERE rating = 3) as rating_3_count,
        COUNT(*) FILTER (WHERE rating = 4) as rating_4_count,
        COUNT(*) FILTER (WHERE rating = 5) as rating_5_count,
        MAX(created_at) as last_rating_at
    FROM public.ratings
    WHERE rated_entity_type = NEW.rated_entity_type 
    AND rated_entity_id = NEW.rated_entity_id
    GROUP BY rated_entity_type, rated_entity_id
    
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        total_ratings = EXCLUDED.total_ratings,
        average_rating = EXCLUDED.average_rating,
        rating_1_count = EXCLUDED.rating_1_count,
        rating_2_count = EXCLUDED.rating_2_count,
        rating_3_count = EXCLUDED.rating_3_count,
        rating_4_count = EXCLUDED.rating_4_count,
        rating_5_count = EXCLUDED.rating_5_count,
        last_rating_at = EXCLUDED.last_rating_at,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update aggregates
CREATE TRIGGER trigger_update_rating_aggregates
    AFTER INSERT OR UPDATE OR DELETE ON public.ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_rating_aggregates();

-- Add comments
COMMENT ON TABLE public.ratings IS 'Stores all ratings given by users in the system';
COMMENT ON COLUMN public.ratings.rating_type IS 'Type of rating being given';
COMMENT ON COLUMN public.ratings.rater_user_id IS 'User giving the rating (type inferred from user profile)';
COMMENT ON COLUMN public.ratings.rated_entity_type IS 'Type of entity being rated';
COMMENT ON COLUMN public.ratings.rated_entity_id IS 'ID of the entity being rated';
COMMENT ON COLUMN public.ratings.rating IS 'Rating value from 1 to 5';
COMMENT ON COLUMN public.ratings.is_verified IS 'Whether this rating is from a verified completed order';
COMMENT ON TABLE public.rating_aggregates IS 'Cached aggregated rating statistics for performance';
