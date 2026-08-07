# Map product taxonomy (prod | dev)

Map `item_sub_categories` to Google / Facebook product taxonomy IDs for **prod** or **dev**.

## Follow the skill

Read and follow the project skill:

`.cursor/skills/map-product-taxonomy/SKILL.md`

## Arguments

Parse the user message / command args:

| Arg | Meaning |
|-----|---------|
| `prod` / `production` | Use `production-rendasua-backend-secrets` |
| `dev` / `development` | Use `development-rendasua-backend-secrets` |
| `--min-similarity N` | Optional (default **0.45**; use **0.35** for a broader second pass) |
| `--embed-taxonomy` | Optional; refresh taxonomy embeddings before mapping |

If env is missing, ask once (`prod` or `dev`).

## Execute

Prefer the wrapper (creates venv, loads Secrets Manager, maps, prints coverage):

```bash
cd /Users/besongsamuel/Documents/Github/rs/rendasua/tools/embed-product-taxonomy
chmod +x run-map.sh
./run-map.sh <prod|dev> [--min-similarity 0.45] [--embed-taxonomy]
```

Never print `DATABASE_URL`. Confirm prod writes when the user asked for prod.

## Done

Report: env, min-similarity, coverage (`with_fb` / `total`), and how many still missing FB category.
