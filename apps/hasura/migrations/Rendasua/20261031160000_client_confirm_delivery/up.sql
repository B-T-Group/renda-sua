-- Client-confirmed delivery: commit new order_status values in their own transaction.
-- Postgres 55P04: a new enum value cannot be used (indexes, CHECK, casts) until COMMIT.
-- Do not add columns, indexes, tables, or config here.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_client_confirmation';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_auto_complete';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'disputed';
