-- Create account_type enum
CREATE TYPE public.account_type_enum AS ENUM ('client', 'agent', 'business');

-- Create comprehensive currency enum
CREATE TYPE public.currency_enum AS ENUM (
    -- Major Global Currencies
    'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD',
    
    -- African Currencies
    'XAF', 'XOF', 'NGN', 'ZAR', 'EGP', 'KES', 'GHS', 'MAD', 'TND', 'DZD', 
    'ETB', 'UGX', 'TZS', 'MWK', 'ZMW', 'BWP', 'NAM', 'LSL', 'SZL', 'MUR', 
    'SCR', 'CDF', 'RWF', 'BIF', 'SDG', 'SOS', 'DJF', 'KMF', 'MGA',
    
    -- Asian Currencies
    'INR', 'KRW', 'SGD', 'HKD', 'TWD', 'THB', 'MYR', 'IDR', 'PHP', 'VND', 
    'PKR', 'BDT', 'LKR', 'NPR', 'MMK', 'KHR', 'LAK', 'MNT',
    
    -- European Currencies
    'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RSD', 
    'ALL', 'MKD', 'BAM', 'MDL', 'UAH', 'BYN', 'RUB', 'TRY', 'GEL', 'AMD', 'AZN',
    
    -- Americas Currencies
    'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'PYG', 'BOB', 'VES', 
    'GTQ', 'HNL', 'NIO', 'CRC', 'PAB', 'DOP', 'JMD', 'TTD', 'BBD', 'XCD',
    
    -- Oceania Currencies
    'NZD', 'FJD', 'PGK', 'WST', 'TOP', 'VUV', 'SBD',
    
    -- Middle East Currencies
    'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LBP', 'ILS', 'IRR', 'IQD', 'AFN'
);

-- Create accounts table
CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    account_type account_type_enum NOT NULL,
    currency currency_enum NOT NULL,
    available_balance DECIMAL(18,2) NOT NULL DEFAULT 0, -- Available for new orders
    withheld_balance DECIMAL(18,2) NOT NULL DEFAULT 0,  -- Held for pending orders
    total_balance DECIMAL(18,2) GENERATED ALWAYS AS (available_balance + withheld_balance) STORED,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE UNIQUE INDEX idx_accounts_user_currency ON public.accounts(user_id, currency);
CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_accounts_active ON public.accounts(is_active);

-- Create trigger for updated_at column
CREATE TRIGGER set_public_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comments
COMMENT ON TABLE public.accounts IS 'User accounts with multiple currencies and balance tracking';
COMMENT ON COLUMN public.accounts.available_balance IS 'Balance available for new orders';
COMMENT ON COLUMN public.accounts.withheld_balance IS 'Balance held for pending orders';
COMMENT ON COLUMN public.accounts.total_balance IS 'Computed total balance (available + withheld)';
