-- Delete duplicate decline-history rows before 20261119140000 creates the unique index.
-- That migration is already applied on DEV, so its file is not changed. Hasura applies
-- this earlier version on any database that has not recorded it, including one that
-- already has 140000. The delete is a no-op when the unique index already forbids duplicates.
DELETE FROM public.rental_status_history
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      row_number() OVER (
        PARTITION BY rental_booking_id
        ORDER BY created_at ASC, id ASC
      ) AS n
    FROM public.rental_status_history
    WHERE notes = 'Renter declined the pickup condition'
  ) ranked
  WHERE ranked.n > 1
);
