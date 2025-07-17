-- Remove 'complete' status from order_status enum
-- Note: PostgreSQL doesn't support removing enum values directly
-- This would require recreating the enum without the 'complete' value
-- For now, we'll leave this as a comment since it's complex to implement
-- and the 'complete' status is unlikely to be removed once added

-- To remove 'complete' status, you would need to:
-- 1. Create a new enum without 'complete'
-- 2. Update all columns using the old enum to use the new one
-- 3. Drop the old enum
-- 4. Rename the new enum to the original name

-- This is a complex operation and should be done manually if needed
