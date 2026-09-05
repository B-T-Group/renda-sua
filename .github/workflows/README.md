# CI/CD Workflows

This directory contains GitHub Actions workflows for automated deployment and testing.

## Concurrency Strategy

All deployment workflows use GitHub Actions `concurrency` groups to prevent conflicting deploys:

- **Development workflows** (`main` branch): Use `cancel-in-progress: true` to cancel superseded deploys and always deploy the latest code.
- **Production workflows** (`prod` branch): Use `cancel-in-progress: false` to queue deploys, ensuring in-flight production deploys complete safely.
- Each workflow has a unique concurrency group to prevent cross-environment interference (e.g., dev deploys don't cancel prod deploys).

This prevents "deployment already in progress" errors and ensures safe, sequential deploys to each environment.

## Workflows

### 1. Deploy Backend (`deploy-backend.yml`)

**Trigger:** Push to `main` or `prod` branch with changes to backend files
**Purpose:** Deploy the NestJS backend to AWS Lightsail Container Service

**Files monitored:**

- `apps/backend/**`
- `package.json`
- `Dockerfile.backend`
- `Dockerfile.backend.prod`
- `nx.json`
- `tsconfig.base.json`

**Process:**

1. Build backend application
2. Build Docker container
3. Push to Amazon ECR
4. Deploy to Lightsail Container Service (with retry on failure)

**Concurrency Control:**

- **Development (main branch):** Only one deploy runs at a time. New deploys cancel in-progress ones (`cancel-in-progress: true`), as dev deploys can safely be superseded.
- **Production (prod branch):** Only one deploy runs at a time. New deploys queue until the current one finishes (`cancel-in-progress: false`), ensuring production deploys complete safely.
- Separate concurrency groups prevent dev/prod cross-cancellation.
- Lightsail deploy step includes retry logic (up to 3 attempts with backoff) to handle transient "deployment already in progress" errors.

### 2. Deploy CDK Infrastructure (`deploy-cdk.yml`)

**Trigger:** Push to `main` branch with changes to CDK files
**Purpose:** Deploy AWS infrastructure using CDK

**Files monitored:**

- `apps/cdk/**`
- `package.json`
- `nx.json`
- `tsconfig.base.json`

**Process:**

1. Install dependencies and AWS CDK
2. Bootstrap CDK (if needed)
3. Build CDK application
4. Synthesize CloudFormation template (development + shared Hasura stack)
5. Deploy to development environment and shared Hasura stack
6. Verify deployment

**Concurrency Control:**

- Only one dev CDK deploy runs at a time
- New deploys cancel in-progress ones (`cancel-in-progress: true`)

### 3. Deploy CDK to Production (`deploy-cdk-production.yml`)

**Trigger:** Push to `prod` branch or manual workflow dispatch
**Purpose:** Deploy CDK infrastructure to production/staging environments

**Features:**

- Manual trigger with environment selection
- Production environment protection
- Deployment plan preview
- Environment-specific deployment (production stack only; excludes shared Hasura stack)

**Concurrency Control:**

- Only one production CDK deploy runs at a time
- New deploys queue until current one finishes (`cancel-in-progress: false`)

### 4. Apply Hasura Migrations (`hasura-apply.yml`)

**Trigger:** Push to `main` or `prod` branch with changes to Hasura files
**Purpose:** Apply Hasura migrations and metadata to development or production

**Files monitored:**

- `apps/hasura/**`
- `.github/actions/apply-hasura/**`
- `.github/workflows/hasura-apply.yml`

**Process:**

1. Checkout code
2. Configure AWS credentials
3. Apply Hasura migrations and metadata using reusable action

**Concurrency Control:**

- **Development:** Only one dev Hasura apply runs at a time. New applies cancel in-progress ones (`cancel-in-progress: true`).
- **Production:** Only one production Hasura apply runs at a time. New applies queue until current one finishes (`cancel-in-progress: false`).
- Separate concurrency groups for dev/prod environments.

## Required Secrets

The following secrets must be configured in your GitHub repository:

### AWS Credentials

- `AWS_ROLE_ARN`: ARN of the IAM role for GitHub Actions
- `AWS_ACCOUNT_ID`: AWS account ID for CDK deployment

### Backend Secrets

- `HASURA_GRAPHQL_ADMIN_SECRET`: Hasura admin secret
- `AWS_ACCESS_KEY_ID`: AWS access key for backend
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for backend

## Environment Variables

### CDK Deployment

- `AWS_REGION`: AWS region (default: `ca-central-1`)
- `CDK_ENVIRONMENT`: Target environment (default: `development`)

### Backend Deployment

- `LIGHTSAIL_CONTAINER_SERVICE`: Lightsail service name
- `ECR_REPOSITORY`: ECR repository name
- `ECR_REGISTRY`: ECR registry URL

## Manual Deployment

### CDK Infrastructure

```bash
# Deploy to development
yarn cdk:deploy:dev

# Deploy to staging
yarn cdk:deploy:staging

# Deploy to production
yarn cdk:deploy:prod

# Bootstrap CDK (first time only)
yarn cdk:bootstrap

# View differences
yarn cdk:diff

# Synthesize template
yarn cdk:synth
```

### Backend

```bash
# Build backend
yarn build:backend

# Deploy backend
# (Use GitHub Actions workflow)
```

## Monitoring

### CDK Deployment

- Check CloudFormation console for deployment status
- Monitor CloudWatch logs for Lambda functions
- Verify EventBridge rules are active

### Backend Deployment

- Check Lightsail console for container service status
- Monitor application logs in Lightsail
- Verify ECR repository for new images

## Troubleshooting

### CDK Issues

1. **Bootstrap Required**: Run `yarn cdk:bootstrap` first
2. **Permission Errors**: Verify IAM role has required permissions
3. **Environment Issues**: Check environment variables and secrets

### Backend Issues

1. **Build Failures**: Check Node.js version and dependencies
2. **Deployment Failures**: Verify Lightsail service configuration
3. **Environment Issues**: Check environment variables in deployment

## Security

- All workflows use OIDC for AWS authentication
- Production deployments require manual approval
- Secrets are encrypted and never logged
- Least privilege IAM roles are used
