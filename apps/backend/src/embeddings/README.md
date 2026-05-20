# Item embeddings (semantic catalog search)

- **Columns:** `items.name_embedding`, `items.description_embedding` (`vector(1536)`, OpenAI `text-embedding-3-small`).
- **Writes:** `ItemEmbeddingService` from `BusinessItemsService` on create/update/CSV; Hasura event triggers on `items` INSERT/UPDATE (name/description) call `POST /api/internal/items/embeddings/sync` with `x-internal-api-key` = `NOTIFICATIONS_INTERNAL_API_KEY`.
- **Search:** `GET /inventory-items?search=` and `GET /inventory-items/search/suggestions?q=` use cosine similarity (threshold `INVENTORY_SEARCH_MIN_SIMILARITY`, default `0.38`).
- **Backfill:** `tools/embed-items/embed_items.py` after migration `20260520120000_items_embedding_search`.
