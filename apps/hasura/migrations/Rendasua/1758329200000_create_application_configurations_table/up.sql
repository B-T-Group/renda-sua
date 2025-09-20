CREATE TABLE public.application_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Configuration Identity
    config_key VARCHAR(255) NOT NULL,
    config_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Data Type and Value
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN (
        'string', 'number', 'boolean', 'json', 'array', 'date', 'currency'
    )),
    string_value TEXT,
    number_value DECIMAL(15,4),
    boolean_value BOOLEAN,
    json_value JSONB,
    array_value TEXT[], -- For simple arrays
    date_value TIMESTAMP WITH TIME ZONE,
    
    -- Localization
    country_code VARCHAR(2), -- ISO 3166-1 alpha-2 (e.g., 'CM', 'US')
    
    -- Status and Versioning
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Metadata
    tags TEXT[], -- For flexible categorization
    
    -- Validation Rules
    validation_rules JSONB, -- Store validation constraints
    min_value DECIMAL(15,4), -- For numeric validations
    max_value DECIMAL(15,4), -- For numeric validations
    allowed_values TEXT[], -- For enum-like validations
    
    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID, -- Reference to user who created this config
    updated_by UUID, -- Reference to user who last updated this config
    
    -- Constraints
    CONSTRAINT unique_config_key_country UNIQUE (config_key, country_code),
    CONSTRAINT config_value_not_null CHECK (
        (data_type = 'string' AND string_value IS NOT NULL) OR
        (data_type = 'number' AND number_value IS NOT NULL) OR
        (data_type = 'boolean' AND boolean_value IS NOT NULL) OR
        (data_type = 'json' AND json_value IS NOT NULL) OR
        (data_type = 'array' AND array_value IS NOT NULL) OR
        (data_type = 'date' AND date_value IS NOT NULL) OR
        (data_type = 'currency' AND (string_value IS NOT NULL OR number_value IS NOT NULL))
    )
);

-- Indexes for performance
CREATE INDEX idx_application_configurations_key ON public.application_configurations (config_key);
CREATE INDEX idx_application_configurations_country ON public.application_configurations (country_code);
CREATE INDEX idx_application_configurations_status ON public.application_configurations (status);
CREATE INDEX idx_application_configurations_active ON public.application_configurations (config_key, country_code) WHERE status = 'active';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_application_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_application_configurations_updated_at
    BEFORE UPDATE ON public.application_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_application_configurations_updated_at();
