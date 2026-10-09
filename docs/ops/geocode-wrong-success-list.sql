-- READ ONLY. Lists addresses the OLD nightly geocode cron (pre-#524) marked
-- geocode_status = 'success' (only the cron writes that column), and says which of them the
-- reset script would touch.
--
-- would_reset = the NEW cron could refill the row (same eligibility as the cron's Hasura filter:
--   active, linked to a client, not business / agent / business-location / order-linked)
--   AND its text fails the new text rules (suspect_text). Everything else is left alone:
--   business/agent/order-linked coordinates feed dispatch/distance and the new cron would
--   never refill them.
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
  x.suspect_text,
  x.eligible_for_cron,
  (x.suspect_text AND x.eligible_for_cron AND NOT x.edited_after_cron) AS would_reset,
  x.soft_deleted, x.business, x.agent, x.used_by_order, x.has_client_link, x.edited_after_cron
FROM addresses a
CROSS JOIN LATERAL (
  SELECT
    (char_length(btrim(a.address_line_1)) < 5
      OR (SELECT count(*) FROM regexp_matches(a.address_line_1, '[[:alpha:]]', 'g')) < 3
      OR char_length(btrim(a.city)) < 2) AS suspect_text,
    a.status <> 'active' AS soft_deleted,
    (EXISTS (SELECT 1 FROM business_addresses b WHERE b.address_id = a.id)
      OR EXISTS (SELECT 1 FROM business_locations bl WHERE bl.address_id = a.id)) AS business,
    EXISTS (SELECT 1 FROM agent_addresses g WHERE g.address_id = a.id) AS agent,
    EXISTS (SELECT 1 FROM orders o WHERE o.delivery_address_id = a.id) AS used_by_order,
    EXISTS (SELECT 1 FROM client_addresses c WHERE c.address_id = a.id) AS has_client_link,
    (a.updated_at > a.geocode_attempted_at + interval '1 minute') AS edited_after_cron
) pre
CROSS JOIN LATERAL (
  SELECT pre.suspect_text, pre.soft_deleted, pre.business, pre.agent, pre.used_by_order,
         pre.has_client_link, pre.edited_after_cron,
         (NOT pre.soft_deleted AND pre.has_client_link AND NOT pre.business
          AND NOT pre.agent AND NOT pre.used_by_order) AS eligible_for_cron
) x
WHERE a.geocode_status = 'success'
ORDER BY would_reset DESC, x.suspect_text DESC, a.geocode_attempted_at DESC;
