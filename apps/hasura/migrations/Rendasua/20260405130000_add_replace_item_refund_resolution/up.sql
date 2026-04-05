-- Replace-item resolution: business replaces the item with free delivery (no wallet refund)

ALTER TYPE refund_request_status ADD VALUE 'approved_replace_item';

ALTER TYPE order_status ADD VALUE 'refund_approved_replace';
