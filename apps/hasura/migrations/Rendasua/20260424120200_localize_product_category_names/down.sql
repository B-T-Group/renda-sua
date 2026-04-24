-- Reverts 20260424120200 only for databases that had the legacy `name` column (before rename).
-- If your DB was created with `name_en` / `name_fr` from 20260424120000, do not use this down; restore from backup instead.

SELECT 1;
