-- Cannot remove enum values from payment_entity_type without rewriting the type.
-- Down is a no-op; the extra value is unused if this migration is reverted.
SELECT 1;
