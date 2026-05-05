# AWS (Backend)

## What AWS is

AWS is the cloud platform used for:

- Infrastructure (deployment, CI/CD automation)
- Secrets management in production/CI
- Object storage uploads (S3) via pre-signed URLs

Existing technical doc:

- `apps/backend/src/aws/README.md`

## What we use AWS for (in this repo)

### 1) S3 uploads (pre-signed URLs)

The backend can generate pre-signed URLs that allow the frontend to upload files to S3 without exposing AWS credentials.

### 2) Secrets in CI/CD

The repo also references AWS Secrets Manager in CI workflows and infrastructure (for example, applying Hasura migrations by retrieving secrets).

## Configuration required (Backend)

Required for AWS SDK access in environments where the backend talks to AWS:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Optional (used for S3 features):

- `S3_BUCKET_NAME`
- `S3_BUCKET_REGION` (defaults to `AWS_REGION` if not set)

Optional (logging):

- `ENABLE_CLOUDWATCH` (`true` to enable)
- `CLOUDWATCH_LOG_GROUP`
- `CLOUDWATCH_LOG_STREAM`

## What else is needed outside code

- An AWS account with:
  - IAM credentials with least-privilege permissions
  - S3 bucket(s) configured (including CORS if browser uploads are used)
  - (Optional) Secrets Manager entries for production secrets

## What can break

- File uploads fail if the IAM credentials lack S3 permissions or bucket CORS is wrong.
- CI tasks fail if secrets cannot be read from AWS Secrets Manager.

