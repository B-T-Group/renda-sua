-- Switch catalog embeddings from OpenAI text-embedding-3-small to Amazon Titan
-- Embed Text v1 (still 1536d). Existing OpenAI vectors are not comparable to Titan
-- query vectors, so clear them; semantic search falls back to text until
-- tools/embed-items/embed_items.py backfills with Titan.

UPDATE public.items
SET name_embedding = NULL,
    description_embedding = NULL
WHERE name_embedding IS NOT NULL
   OR description_embedding IS NOT NULL;

COMMENT ON COLUMN public.items.name_embedding IS
  'Embedding of items.name (amazon.titan-embed-text-v1, 1536d) for semantic catalog search';
COMMENT ON COLUMN public.items.description_embedding IS
  'Embedding of items.description when non-empty (amazon.titan-embed-text-v1, 1536d)';
