-- Add verified_agent_delivery column to orders table
ALTER TABLE public.orders 
ADD COLUMN verified_agent_delivery BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.verified_agent_delivery IS 'When true, only verified agents can pick up this order';
