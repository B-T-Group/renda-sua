-- Multilingual semantic embeddings (384d) for taxonomy matching. Values are filled by
-- tools/embed-product-taxonomy/embed_product_taxonomy.py after this migration runs.
-- Requires PostgreSQL image / extension: CREATE EXTENSION vector (pgvector).

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.google_product_categories
  ADD COLUMN IF NOT EXISTS embedding vector(384);

ALTER TABLE public.fb_product_categories
  ADD COLUMN IF NOT EXISTS embedding vector(384);

COMMENT ON COLUMN public.google_product_categories.embedding IS
  'L2-normalized embedding (paraphrase-multilingual-MiniLM-L12-v2, 384d); from name_en and optional name_fr';
COMMENT ON COLUMN public.fb_product_categories.embedding IS
  'L2-normalized embedding (paraphrase-multilingual-MiniLM-L12-v2, 384d); from name_en and optional name_fr';
