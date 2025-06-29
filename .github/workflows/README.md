# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automated deployment.

## Backend Deployment to AWS Lightsail Container Service

The `deploy-backend.yml` workflow automatically deploys the backend to AWS Lightsail Container Service when changes are pushed to the `main` branch.

### Prerequisites

1. **AWS Lightsail Container Service**: Create a container service in AWS Lightsail
2. **AWS IAM Role with OIDC**: Create an IAM role configured for GitHub Actions OIDC
3. **GitHub Secrets**: Configure the required secrets in your GitHub repository

### Setup Instructions

#### 1. Create AWS Lightsail Container Service

1. Go to AWS Lightsail Console
2. Navigate to "Containers" → "Container services"
3. Click "Create container service"
4. Choose a plan (Nano is sufficient for development)
5. Name your service: `rendasua-backend-service`
6. Click "Create container service"

#### 2. Create AWS IAM Role with OIDC

1. **Create Identity Provider**:

   ```bash
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com \
     --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
   ```

2. **Create IAM Role**:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/YOUR_REPO_NAME:*"
           }
         }
       }
     ]
   }
   ```

3. **Attach Lightsail Policy**:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["lightsail:GetContainerServices", "lightsail:CreateContainerService", "lightsail:UpdateContainerService", "lightsail:DeleteContainerService", "lightsail:GetContainerImages", "lightsail:RegisterContainerImage", "lightsail:PushContainerImage", "lightsail:GetContainerLogs", "lightsail:GetContainerServiceDeployments", "lightsail:CreateContainerServiceDeployment", "lightsail:WaitContainerServiceStable"],
         "Resource": "*"
       }
     ]
   }
   ```

4. **Save the Role ARN** (format: `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME`)

#### 3. Configure GitHub Secrets

In your GitHub repository, go to Settings → Secrets and variables → Actions, and add the following secrets:

- **AWS_ROLE_ARN**: Your IAM role ARN (e.g., `arn:aws:iam::123456789012:role/github-actions-lightsail`)
- **HASURA_GRAPHQL_ENDPOINT**: Your Hasura GraphQL endpoint URL
- **HASURA_GRAPHQL_ADMIN_SECRET**: Your Hasura admin secret

#### 4. Update Environment Variables (Optional)

If you need to change the AWS region or container service name, edit the `env` section in `deploy-backend.yml`:

```yaml
env:
  AWS_REGION: ca-central-1 # Change to your preferred region
  LIGHTSAIL_CONTAINER_SERVICE: rendasua-backend-service # Change to your service name
  LIGHTSAIL_CONTAINER_NAME: backend
```

### OIDC Benefits

- **No long-term credentials**: No need to store AWS access keys in GitHub secrets
- **Temporary credentials**: Each workflow run gets fresh, short-lived credentials
- **Enhanced security**: Credentials are automatically rotated and have minimal scope
- **Audit trail**: All actions are tied to specific GitHub workflow runs

### How It Works

1. **Trigger**: Workflow runs on push to `main` branch or manual trigger
2. **OIDC Authentication**: GitHub Actions obtains temporary AWS credentials via OIDC
3. **Build**: Builds the backend using Nx
4. **Docker**: Creates a Docker image from the built backend
5. **Push**: Pushes the image to Lightsail Container Service using AWS CLI
6. **Deploy**: Creates a new deployment with environment variables
7. **Wait**: Waits for deployment to stabilize
8. **Health Check**: Verifies the deployment is successful

### AWS CLI Commands Used

The workflow uses the following AWS CLI commands:

- `aws lightsail push-container-image`: Pushes Docker image to Lightsail
- `aws lightsail create-container-service-deployment`: Creates new deployment
- `aws lightsail wait container-service-stable`: Waits for deployment to complete
- `aws lightsail get-container-service`: Gets service information and URL

### Monitoring

- **GitHub Actions**: Check the Actions tab in your repository
- **Lightsail Console**: Monitor your container service in AWS Lightsail
- **Health Endpoint**: The backend exposes a `/health` endpoint for monitoring

### Troubleshooting

#### Common Issues

1. **Permission Denied**: Ensure your IAM role has the correct permissions and trust policy
2. **OIDC Provider Not Found**: Verify the identity provider is created correctly
3. **Container Service Not Found**: Verify the service name in the workflow matches your Lightsail service
4. **Health Check Fails**: Check the container logs in Lightsail Console
5. **Environment Variables**: Ensure all required secrets are set in GitHub
6. **AWS CLI Version**: Ensure the workflow uses a recent version of AWS CLI

#### Debugging

1. Check the GitHub Actions logs for detailed error messages
2. Use Lightsail Console to view container logs
3. Test the health endpoint manually: `https://your-service-url/health`
4. Verify OIDC setup with AWS CLI: `aws sts assume-role-with-web-identity`
5. Test AWS CLI commands locally: `aws lightsail get-container-services`

### Manual Deployment

You can manually trigger the deployment by:

1. Going to the Actions tab in your GitHub repository
2. Selecting "Deploy Backend to Lightsail Container"
3. Clicking "Run workflow"

### Rollback

To rollback to a previous version:

1. Go to Lightsail Console
2. Navigate to your container service
3. Go to "Deployments" tab
4. Select a previous deployment and click "Deploy"

### Security Best Practices

1. **Principle of Least Privilege**: Only grant the minimum permissions needed
2. **Role Scope**: Limit the role to specific repositories and branches
3. **Regular Audits**: Review and rotate permissions regularly
4. **Monitoring**: Set up CloudTrail to monitor role usage
