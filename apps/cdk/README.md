# Rendasua CDK Infrastructure

This AWS CDK application manages the infrastructure for the Rendasua platform, including automated mobile payments key refresh functionality.

## Overview

The CDK app creates and manages AWS resources for the Rendasua platform, with a focus on:

- **Mobile Payments Key Refresh**: Automated Lambda function that refreshes MyPVit API keys every 45 minutes
- **Secrets Management**: Secure storage and rotation of API keys
- **Event-Driven Architecture**: EventBridge rules for scheduled operations

## Architecture

### Mobile Payments Key Refresh

- **Lambda Function**: `refresh-mobile-payments-key-{env}`
- **Schedule**: Every 45 minutes via EventBridge
- **Purpose**: Automatically renews MyPVit API secret keys
- **Storage**: Updates AWS Secrets Manager with new keys

### Resources Created

1. **Lambda Function**

   - Runtime: Node.js 18.x
   - Memory: 256 MB
   - Timeout: 5 minutes
   - Log Retention: 1 week

2. **EventBridge Rule**

   - Schedule: Every 45 minutes
   - Target: Lambda function
   - Retry Attempts: 3

3. **IAM Permissions**

   - Secrets Manager access for key updates
   - CloudWatch Logs for monitoring

4. **CloudWatch Log Group**
   - Automatic log collection
   - 1-week retention policy

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js** 18.x or later
3. **AWS CDK** CLI installed globally
4. **TypeScript** knowledge

## Installation

```bash
# Install dependencies
cd apps/cdk
npm install

# Install AWS CDK globally (if not already installed)
npm install -g aws-cdk
```

## Configuration

### Environment Variables

The Lambda function uses the following environment variables:

```env
ENVIRONMENT=dev|staging|production
OPERATION_ACCOUNT_CODE=XXXXXXXX  # MyPVit operation account code
RECEPTION_URL_CODE=XXXXXXXX      # MyPVit reception URL code
```

### AWS Secrets Manager

The function retrieves the refresh password from the following secret:

```json
{
  "MYPVIT_SECRET_KEY_REFRESH_PASSWORD": "your-refresh-password"
}
```

**Secret Name**: `development-rendasua-backend-secrets`

## Deployment

### First Time Setup

```bash
# Bootstrap CDK (only needed once per account/region)
cdk bootstrap

# Deploy for development environment
cdk deploy --context environment=dev

# Deploy for production environment
cdk deploy --context environment=production
```

### Subsequent Deployments

```bash
# Deploy changes
cdk deploy --context environment=dev

# Deploy to specific environment
cdk deploy --context environment=production
```

### Destroy Infrastructure

```bash
# Remove all resources
cdk destroy --context environment=dev
```

## Development

### Local Testing

```bash
# Synthesize CloudFormation template
cdk synth --context environment=dev

# View differences before deployment
cdk diff --context environment=dev
```

### Lambda Function Development

The Lambda function is located in `src/lambda/refresh-mobile-payments-key.ts`.

To test locally:

```bash
# Install Lambda function dependencies
cd src/lambda
npm install

# Build the function
npm run build
```

### Adding New Resources

1. Create new constructs in `src/lib/`
2. Import and use them in the main stack
3. Update this README with new resources

## Monitoring

### CloudWatch Logs

Monitor the Lambda function execution:

```bash
# View recent logs
aws logs tail /aws/lambda/refresh-mobile-payments-key-dev --follow

# View specific log stream
aws logs describe-log-streams --log-group-name /aws/lambda/refresh-mobile-payments-key-dev
```

### CloudWatch Metrics

Key metrics to monitor:

- Lambda invocation count
- Lambda error count
- Lambda duration
- EventBridge rule trigger count

## Security

### IAM Permissions

The Lambda function has minimal required permissions:

- `secretsmanager:GetSecretValue` (for accessing the refresh password)

### Secrets Management

- Refresh password is stored in AWS Secrets Manager
- The function retrieves the password securely at runtime
- Access is restricted via IAM policies

## Troubleshooting

### Common Issues

1. **Lambda Timeout**

   - Check MyPVit API response times
   - Increase Lambda timeout if needed

2. **Permission Denied**

   - Verify IAM roles and policies
   - Check Secrets Manager permissions

3. **API Key Refresh Failed**
   - Check MyPVit API status
   - Verify API credentials
   - Review CloudWatch logs

### Debugging

```bash
# View Lambda function logs
aws logs tail /aws/lambda/refresh-mobile-payments-key-dev --follow

# Test Lambda function manually
aws lambda invoke --function-name refresh-mobile-payments-key-dev --payload '{"environment":"dev"}' response.json

# Check EventBridge rule status
aws events describe-rule --name refresh-mobile-payments-key-rule-dev
```

## Contributing

1. Create a feature branch
2. Make changes to the CDK code
3. Test with `cdk synth` and `cdk diff`
4. Deploy to development environment
5. Create a pull request

## Support

For issues related to:

- **CDK Infrastructure**: Check AWS CDK documentation
- **Lambda Function**: Review CloudWatch logs
- **MyPVit Integration**: Contact MyPVit support

## License

This project is part of the Rendasua platform and follows the same licensing terms.
