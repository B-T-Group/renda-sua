-- One hold per statement. Concurrent month-close used to insert two rows and
-- later release the same 10% twice (each hold has its own wallet reference).

DELETE FROM public.representative_commission_holds a
USING public.representative_commission_holds b
WHERE a.statement_id = b.statement_id
  AND a.ctid < b.ctid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_representative_commission_holds_statement'
  ) THEN
    ALTER TABLE public.representative_commission_holds
      ADD CONSTRAINT uq_representative_commission_holds_statement UNIQUE (statement_id);
  END IF;
END $$;
