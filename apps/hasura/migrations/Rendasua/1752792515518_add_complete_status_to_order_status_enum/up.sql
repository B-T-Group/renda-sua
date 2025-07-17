-- Add 'complete' status to order_status enum
ALTER TYPE order_status ADD VALUE 'complete' AFTER 'delivered';
