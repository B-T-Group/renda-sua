# AI Module

AI-powered product description generation, image suggestions, refinement, and
related chat/vision features via **Amazon Bedrock Runtime Converse** (configurable
model, default `amazon.nova-lite-v1:0` in `us-east-1`).

**OpenAI** is used only for **product image cleanup** (Images Edits API).

## Features

- **Product Description Generation** — Bedrock Converse (Nova)
- **Image → item / rental suggestions** — Bedrock Converse multimodal
- **Item refinement & collection suggestions** — Bedrock Converse
- **Image cleanup** — OpenAI Images Edits (token-gated)
- Multilingual (EN/FR), JWT-protected, Swagger-documented

## API Endpoint

### Generate Product Description

**POST** `/ai/generate-description`

**Authentication**: Bearer token required

**Request Body**:

```json
{
  "name": "Wireless Bluetooth Headphones",
  "sku": "WBH-001",
  "category": "Electronics",
  "subCategory": "Audio & Headphones",
  "price": 99.99,
  "currency": "XAF",
  "weight": 250,
  "weightUnit": "g",
  "brand": "TechSound",
  "language": "en"
}
```

**Response**:

```json
{
  "success": true,
  "description": "Experience premium sound quality with our wireless Bluetooth headphones...",
  "message": "Product description generated successfully"
}
```

## Environment Setup

```bash
# OpenAI — image cleanup only
OPENAI_API_KEY=your_openai_api_key_here

# Bedrock Runtime Converse — all other LLM/vision (never set AWS_REGION to us-east-1 for the whole app)
BEDROCK_REGION=us-east-1
BEDROCK_CHAT_MODEL=amazon.nova-lite-v1:0
BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v1

# Optional per-feature overrides (default to BEDROCK_CHAT_MODEL)
ITEM_AI_REVIEW_MODEL=amazon.nova-lite-v1:0
RENTAL_AI_REVIEW_MODEL=amazon.nova-lite-v1:0
ID_AI_REVIEW_MODEL=amazon.nova-lite-v1:0
```

App infra stays in `ca-central-1`; Bedrock clients call `us-east-1` explicitly.
IAM for the Lightsail credentials must allow `bedrock:InvokeModel` /
`bedrock:Converse` for Nova + Titan in `us-east-1` (see
`docs/integrations/aws/README-backend.md`).

## Error Handling

- Non-cleanup AI failures return generic “AI temporarily unavailable” (429 / 503).
- Image cleanup failures refund merchant AI tokens and mark the job failed.
- Do not surface provider billing/credit errors to merchants.

## Security Notes

- Keys and AWS credentials live in environment / Secrets Manager.
- Endpoints are JWT-protected where applicable.
