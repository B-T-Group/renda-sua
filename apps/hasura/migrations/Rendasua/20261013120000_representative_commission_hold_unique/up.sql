-- One hold per statement. Concurrent month-close used to insert two rows and
-- later release the same 10% twice (each hold has its own wallet reference).
--
-- Dedupe rule (QA F4): per statement keep the hold that already moved money
-- (status 'released' or remaining < amount), otherwise the oldest
-- (created_at, then id). If more than one hold of the same statement moved
-- money, the right survivor is ambiguous: abort and resolve by hand.
-- Removed rows are archived, not lost. Idempotent: with no duplicates and the
-- constraint present this is a no-op.

DO $$
DECLARE
  ambiguous int;
  dupes int;
BEGIN
  SELECT count(*) INTO ambiguous FROM (
    SELECT statement_id
    FROM public.representative_commission_holds
    WHERE status = 'released' OR remaining < amount
    GROUP BY statement_id
    HAVING count(*) > 1
  ) x;
  IF ambiguous > 0 THEN
    RAISE EXCEPTION
      'representative_commission_holds: % statement(s) have more than one released hold; resolve manually before adding uq_representative_commission_holds_statement',
      ambiguous;
  END IF;

  SELECT count(*) INTO dupes FROM (
    SELECT statement_id
    FROM public.representative_commission_holds
    GROUP BY statement_id
    HAVING count(*) > 1
  ) d;

  IF dupes > 0 THEN
    CREATE TABLE IF NOT EXISTS public.representative_commission_holds_dedupe_archive
      (LIKE public.representative_commission_holds INCLUDING DEFAULTS);
    ALTER TABLE public.representative_commission_holds_dedupe_archive
      ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now();

    WITH ranked AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY statement_id
               ORDER BY (status = 'released' OR remaining < amount) DESC,
                        created_at ASC,
                        id ASC
             ) AS rn
      FROM public.representative_commission_holds
    ),
    removed AS (
      DELETE FROM public.representative_commission_holds h
      USING ranked r
      WHERE h.id = r.id AND r.rn > 1
      RETURNING h.*
    )
    INSERT INTO public.representative_commission_holds_dedupe_archive
      (id, statement_id, agent_id, currency, amount, remaining, release_at, status, created_at)
    SELECT id, statement_id, agent_id, currency, amount, remaining, release_at, status, created_at
    FROM removed;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_representative_commission_holds_statement'
  ) THEN
    ALTER TABLE public.representative_commission_holds
      ADD CONSTRAINT uq_representative_commission_holds_statement UNIQUE (statement_id);
  END IF;
END $$;
