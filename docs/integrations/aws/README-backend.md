# AWS (Backend)

## What AWS is

AWS is the cloud platform used for:

- Infrastructure (deployment, CI/CD automation)
- Secrets management in production/CI
- Object storage uploads (S3) via pre-signed URLs
- **Amazon Bedrock Runtime** (Nova Converse chat/vision + Titan embeddings)

Existing technical doc:

- `apps/backend/src/aws/README.md`

## What we use AWS for (in this repo)

### 1) S3 uploads (pre-signed URLs)

The backend can generate pre-signed URLs that allow the frontend to upload files to S3 without exposing AWS credentials.

### 2) Secrets in CI/CD

The repo also references AWS Secrets Manager in CI workflows and infrastructure (for example, applying Hasura migrations by retrieving secrets).

### 3) Bedrock Converse (Nova) + Titan embeddings (cross-region)

The Lightsail backend runs in **`ca-central-1`**. Chat/vision and embeddings use a dedicated Bedrock region:

| Env | Default | Purpose |
|-----|---------|---------|
| `BEDROCK_REGION` | `us-east-1` | Converse (Nova) + Titan Embed Text |
| `BEDROCK_CHAT_MODEL` | `amazon.nova-lite-v1:0` | Default chat/vision model ID |
| `BEDROCK_EMBEDDING_MODEL` | `amazon.titan-embed-text-v1` | Catalog semantic search (1536d) |
| `ITEM_AI_REVIEW_MODEL` / `RENTAL_AI_REVIEW_MODEL` / `ID_AI_REVIEW_MODEL` | falls back to `BEDROCK_CHAT_MODEL` | Per-feature overrides |

**Do not** set Lightsail `AWS_REGION=us-east-1` — that would break S3/SQS/Secrets in Canada. Same IAM keys, different client `region` argument.

OpenAI GPT-5.6 Luna/Terra/Sol on Mantle are **not** used (Marketplace payment/`INVALID_PAYMENT_INSTRUMENT` blocked this account). Prefer Amazon Nova via Converse.

#### IAM (Lightsail IAM user / access keys)

Grant in **us-east-1** (or equivalent custom policy):

- `bedrock:InvokeModel` / `bedrock:Converse` on Nova model ARNs (e.g. `amazon.nova-lite-v1:0`, optionally `amazon.nova-pro-v1:0`)
- `bedrock:InvokeModel` on `arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1`

Managed policy **`AmazonBedrockFullAccess`** covers this; least-privilege custom policies are preferred in production.

#### Console enablement

In the Amazon Bedrock console for **us-east-1**, ensure **Amazon Nova Lite** (and Pro if configured) plus **Titan Embed Text v1** are available to the account.

OpenAI (`OPENAI_API_KEY`) remains required **only** for product image cleanup (Images Edits API).

## Configuration required (Backend)

Required for AWS SDK access in environments where the backend talks to AWS:

- `AWS_REGION` (app region, typically `ca-central-1`)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `BEDROCK_REGION` (default `us-east-1`; must not inherit `AWS_REGION`)

Optional (used for S3 features):

- `S3_BUCKET_NAME`
- `S3_BUCKET_REGION` (defaults to `AWS_REGION` if not set)

Optional (logging):

- `ENABLE_CLOUDWATCH` (`true` to enable)
- `CLOUDWATCH_LOG_GROUP`
- `CLOUDWATCH_LOG_STREAM`

## What else is needed outside code

- An AWS account with:
  - IAM credentials with least-privilege permissions (including Bedrock Nova + Titan in us-east-1)
  - S3 bucket(s) configured (including CORS if browser uploads are used)
  - (Optional) Secrets Manager entries for production secrets
  - Bedrock model access enabled in us-east-1

## What can break

- File uploads fail if the IAM credentials lack S3 permissions or bucket CORS is wrong.
- CI tasks fail if secrets cannot be read from AWS Secrets Manager.
- Descriptions, suggestions, AI review, and semantic search fail if Nova/Titan IAM or model access is missing in us-east-1 (while image cleanup still depends on OpenAI credits).
