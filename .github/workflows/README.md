# CI/CD Workflows

This directory contains GitHub Actions workflows for automated deployment and testing.

## Workflows

### 1. Deploy Backend (`deploy-backend.yml`)

**Trigger:** Push to `main` branch with changes to backend files
**Purpose:** Deploy the NestJS backend to AWS Lightsail Container Service

**Files monitored:**

- `apps/backend/**`
- `package.json`
- `Dockerfile.backend`
- `nx.json`
- `tsconfig.base.json`

**Process:**

1. Build backend application
2. Build Docker container
3. Push to Amazon ECR
4. Deploy to Lightsail Container Service

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
4. Synthesize CloudFormation template
5. Deploy to development environment
6. Verify deployment

### 3. Deploy CDK to Production (`deploy-cdk-production.yml`)

**Trigger:** Manual workflow dispatch
**Purpose:** Deploy CDK infrastructure to production/staging environments

**Features:**

- Manual trigger with environment selection
- Production environment protection
- Deployment plan preview
- Environment-specific deployment

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
