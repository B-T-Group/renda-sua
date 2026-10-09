-- READ ONLY. Lists addresses the OLD nightly geocode cron (pre-hardening) marked
-- geocode_status = 'success'. Only the cron writes geocode_status, so every such row got its
-- coordinates from Google's first result with no precision check.
-- "suspect" = would not pass the new rules on the stored text alone.
SELECT
  a.id,
  a.status,
  a.address_line_1,
  a.city,
  a.country,
  a.latitude,
  a.longitude,
  a.geocode_attempted_at,
  a.updated_at,
  (char_length(btrim(a.address_line_1)) < 5
   OR (SELECT count(*) FROM regexp_matches(a.address_line_1, '[[:alpha:]]', 'g')) < 3
  ) AS suspect_text,
  a.status <> 'active' AS soft_deleted,
  EXISTS (SELECT 1 FROM business_addresses b WHERE b.address_id = a.id)
    OR EXISTS (SELECT 1 FROM business_locations bl WHERE bl.address_id = a.id) AS business,
  EXISTS (SELECT 1 FROM agent_addresses g WHERE g.address_id = a.id) AS agent,
  EXISTS (SELECT 1 FROM orders o WHERE o.delivery_address_id = a.id) AS used_by_order,
  a.updated_at > a.geocode_attempted_at + interval '1 minute' AS edited_after_cron
FROM addresses a
WHERE a.geocode_status = 'success'
ORDER BY suspect_text DESC, a.geocode_attempted_at DESC;
