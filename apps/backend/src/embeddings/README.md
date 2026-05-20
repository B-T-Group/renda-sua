# Item embeddings (semantic catalog search)

- **Columns:** `items.name_embedding`, `items.description_embedding` (`vector(1536)`, OpenAI `text-embedding-3-small`).
- **Writes:** All item create/update paths go through [`ItemsService`](../items/items.service.ts), which persists the row and syncs embeddings (no Hasura event triggers).
- **Search:** `GET /inventory-items?search=` and suggestions use cosine similarity (`INVENTORY_SEARCH_MIN_SIMILARITY`, default `0.38`).
- **Backfill:** `tools/embed-items/embed_items.py` after migration `20260520120000_items_embedding_search`.
