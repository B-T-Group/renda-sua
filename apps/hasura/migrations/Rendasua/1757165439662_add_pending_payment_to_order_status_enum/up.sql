-- Add 'pending_payment' status to order_status enum
ALTER TYPE order_status ADD VALUE 'pending_payment' BEFORE 'pending';
