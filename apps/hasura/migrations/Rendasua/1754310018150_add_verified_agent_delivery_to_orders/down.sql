-- Remove verified_agent_delivery column from orders table
ALTER TABLE public.orders 
DROP COLUMN verified_agent_delivery;
