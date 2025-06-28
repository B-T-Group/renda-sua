-- Create transaction_type enum
CREATE TYPE public.transaction_type_enum AS ENUM (
    'deposit',      -- Money added to account
    'withdrawal',   -- Money removed from account
    'hold',         -- Money held for pending order
    'release',      -- Money released from hold
    'transfer',     -- Transfer between accounts
    'payment',      -- Payment for order/service
    'refund',       -- Refund for cancelled order
    'fee',          -- Service fee
    'adjustment',   -- Manual balance adjustment
    'exchange'      -- Currency exchange
);

-- Alter account_transactions table to use enum
ALTER TABLE public.account_transactions 
ALTER COLUMN transaction_type TYPE public.transaction_type_enum 
USING transaction_type::public.transaction_type_enum;
