-- Semantic search embeddings for catalog items (OpenAI text-embedding-3-small, 1536d).
-- Values are filled by the backend ItemEmbeddingService and tools/embed-items/embed_items.py.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS name_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS description_embedding vector(1536);

COMMENT ON COLUMN public.items.name_embedding IS
  'Embedding of items.name (text-embedding-3-small, 1536d) for semantic catalog search';
COMMENT ON COLUMN public.items.description_embedding IS
  'Embedding of items.description when non-empty (text-embedding-3-small, 1536d)';

CREATE INDEX IF NOT EXISTS idx_items_name_embedding_hnsw
  ON public.items
  USING hnsw (name_embedding vector_cosine_ops)
  WHERE name_embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_items_description_embedding_hnsw
  ON public.items
  USING hnsw (description_embedding vector_cosine_ops)
  WHERE description_embedding IS NOT NULL;
