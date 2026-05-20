DROP INDEX IF EXISTS public.idx_items_description_embedding_hnsw;
DROP INDEX IF EXISTS public.idx_items_name_embedding_hnsw;

ALTER TABLE public.items
  DROP COLUMN IF EXISTS description_embedding,
  DROP COLUMN IF EXISTS name_embedding;
