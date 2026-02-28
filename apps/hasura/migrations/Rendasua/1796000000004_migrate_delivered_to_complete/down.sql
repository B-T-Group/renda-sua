-- No automatic rollback: we cannot restore original 'delivered' vs 'complete' distinction
-- This migration is one-way for data cleanup.
SELECT 1;
