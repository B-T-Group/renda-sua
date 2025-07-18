-- Create delivery_fees table
CREATE TABLE delivery_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conditions JSONB DEFAULT '{}',
    fee DECIMAL(10,2) NOT NULL,
    currency currency_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_delivery_fees_currency ON delivery_fees(currency);
CREATE INDEX idx_delivery_fees_created_at ON delivery_fees(created_at);

-- Insert initial delivery fees data
INSERT INTO delivery_fees (fee, currency, conditions) VALUES
    (1500.00, 'XAF', '{}'),
    (10.00, 'CAD', '{}'),
    (10.00, 'USD', '{}');
