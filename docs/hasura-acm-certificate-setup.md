# Using AWS Certificate Manager (ACM) with Hasura EC2

## Overview

AWS Certificate Manager (ACM) provides free SSL/TLS certificates that are automatically renewed. This is better than Let's Encrypt for production deployments because:

- ✅ Automatic renewal (no rate limiting)
- ✅ Free certificates
- ✅ Integrated with AWS services
- ✅ No certbot configuration needed
- ✅ Managed by AWS

## Setup Steps

### 1. Create ACM Certificate

```bash
# Request a certificate for your domain
aws acm request-certificate \
  --domain-name hasura-dev.rendasua.com \
  --validation-method DNS \
  --region us-east-1
```

This returns a Certificate ARN like:
```
arn:aws:acm:us-east-1:235680477887:certificate/12345678-1234-1234-1234-123456789012
```

### 2. Validate Certificate via DNS

AWS will provide DNS records to add to your Route53 hosted zone. Add these records to validate domain ownership.

```bash
# List pending certificates
aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[?Status==`PENDING_VALIDATION`]'

# Get validation details
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:235680477887:certificate/12345678-1234-1234-1234-123456789012 \
  --region us-east-1
```

Add the DNS validation records to Route53, then wait for validation (usually 5-15 minutes).

### 3. Update CDK Configuration

Add the certificate ARN to `cdk.json`:

```json
{
  "context": {
    "hasuraEc2Enabled": "true",
    "hasuraDevInstanceType": "t4g.small",
    "hasuraDevDbSecretArn": "arn:aws:secretsmanager:ca-central-1:235680477887:secret:hasura-dev-db-7R53Sp",
    "hasuraDevAdminSecretArn": "arn:aws:secretsmanager:ca-central-1:235680477887:secret:hasura-dev-admin-lvXQN9",
    "hasuraDevJwtSecretArn": "arn:aws:secretsmanager:ca-central-1:235680477887:secret:hasura-jwt-secret-dev-RcX0vs",
    "hasuraDevAcmCertificateArn": "arn:aws:acm:us-east-1:235680477887:certificate/12345678-1234-1234-1234-123456789012",
    "hasuraLetsEncryptEmail": "tech@rendasua.com"
  }
}
```

### 4. Update CDK Stack Code

The `HasuraEc2EnvironmentStack` now accepts `acmCertificateArn` in props:

```typescript
new HasuraEc2EnvironmentStack(app, 'HasuraEc2InfrastructureDev', {
  ...commonProps,
  environment: 'dev',
  domainName: hasuraDevDomain,
  graphqlCorsDomain: String(
    app.node.tryGetContext('hasuraDevGraphqlCorsDomain') || hasuraDevCorsDefault
  ),
  dbSecretArn: required('hasuraDevDbSecretArn'),
  adminSecretArn: required('hasuraDevAdminSecretArn'),
  jwtSecretArn: required('hasuraDevJwtSecretArn'),
  acmCertificateArn: app.node.tryGetContext('hasuraDevAcmCertificateArn'), // Optional
});
```

### 5. Deploy

```bash
cd apps/cdk
yarn cdk deploy HasuraEc2InfrastructureDev \
  --context environment=development \
  --context hasuraEnvironment=dev \
  --require-approval never
```

## How It Works

When `acmCertificateArn` is provided:

1. **HTTP → HTTPS Redirect**: All HTTP traffic redirects to HTTPS
2. **ACM Certificate**: Nginx uses the ACM certificate for SSL/TLS
3. **Automatic Renewal**: AWS automatically renews the certificate before expiration
4. **No Certbot**: Certbot is not used (but still installed as fallback)

## Fallback Behavior

If ACM certificate is not available:
- Self-signed certificate is generated automatically
- Nginx uses self-signed cert for HTTPS
- HTTP still works normally

## Comparison: ACM vs Let's Encrypt

| Feature | ACM | Let's Encrypt |
|---------|-----|--------------|
| Cost | Free | Free |
| Renewal | Automatic | Requires certbot |
| Rate Limiting | No | Yes (50 certs/domain/week) |
| Setup | AWS Console | Certbot CLI |
| Validation | DNS/Email | DNS/HTTP |
| Renewal Frequency | Automatic | Every 90 days |
| Integration | AWS native | Third-party |

## Troubleshooting

### Certificate not found
```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:235680477887:certificate/12345678-1234-1234-1234-123456789012 \
  --region us-east-1
```

### HTTPS not working
```bash
# Check nginx logs on EC2
docker exec hasura tail -f /var/log/nginx/error.log

# Check certificate files
ls -la /etc/nginx/ssl/
```

### Renew certificate manually
```bash
# AWS automatically renews, but you can force renewal
aws acm renew-certificate \
  --certificate-arn arn:aws:acm:us-east-1:235680477887:certificate/12345678-1234-1234-1234-123456789012 \
  --region us-east-1
```

## Next Steps

1. Create ACM certificate for your domain
2. Validate via DNS
3. Add certificate ARN to `cdk.json`
4. Redeploy CDK stack
5. Verify HTTPS works: `curl https://hasura-dev.rendasua.com`
