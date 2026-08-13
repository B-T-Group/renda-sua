# Item embeddings (semantic catalog search)

- **Columns:** `items.name_embedding`, `items.description_embedding` (`vector(1536)`, Amazon Titan Embed Text v1 via Bedrock).
- **Writes:** All item create/update paths go through [`ItemsService`](../items/items.service.ts), which persists the row and syncs embeddings (no Hasura event triggers).
- **Search:** `GET /inventory-items?search=` and suggestions use cosine similarity (`INVENTORY_SEARCH_MIN_SIMILARITY`, default `0.38`).
- **Region:** Embeddings always call Bedrock Runtime in `BEDROCK_REGION` (default `us-east-1`), not `AWS_REGION` / `ca-central-1`.
- **Provider switch:** Migration `20260814010000_clear_openai_item_embeddings_for_titan` nulls OpenAI-era vectors so search falls back to text until backfill. **Required after deploy:** `tools/embed-items/embed_items.py` with AWS credentials in `us-east-1`.
- **Semantic search gate:** `BEDROCK_EMBEDDINGS_SEARCH_ENABLED` defaults to `false`. Leave it off until Titan backfill completes, then set `true` and redeploy so vector search turns on safely.
- **Backfill:** `tools/embed-items/embed_items.py` after the clear migration.
