# Docker Setup for Rendasua Backend

This document explains how to build and run the Rendasua backend using Docker with AWS credentials.

## Prerequisites

- Docker installed on your system
- AWS credentials (Access Key ID and Secret Access Key)
- Docker Compose (optional, for easier management)

## Building the Docker Image

### Method 1: Using Docker Build with Build Args

```bash
# Build the image with AWS credentials as build arguments
docker build \
  --build-arg AWS_ACCESS_KEY_ID=your_access_key_id \
  --build-arg AWS_SECRET_ACCESS_KEY=your_secret_access_key \
  --build-arg AWS_REGION=us-east-1 \
  -f Dockerfile.backend \
  -t rendasua-backend:latest .
```

### Method 2: Using Environment Variables

```bash
# Set environment variables
export AWS_ACCESS_KEY_ID=your_access_key_id
export AWS_SECRET_ACCESS_KEY=your_secret_access_key
export AWS_REGION=us-east-1

# Build the image
docker build \
  --build-arg AWS_ACCESS_KEY_ID \
  --build-arg AWS_SECRET_ACCESS_KEY \
  --build-arg AWS_REGION \
  -f Dockerfile.backend \
  -t rendasua-backend:latest .
```

### Method 3: Using Docker Compose

1. Create a `.env` file in the project root:

```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
HASURA_ADMIN_SECRET=your_hasura_admin_secret
```

2. Build and run using Docker Compose:

```bash
# Build and start the service
docker-compose -f docker-compose.backend.yml up --build

# Or run in detached mode
docker-compose -f docker-compose.backend.yml up -d --build
```

## Running the Container

### Method 1: Direct Docker Run

```bash
# Run the container with AWS credentials as environment variables
docker run -d \
  --name rendasua-backend \
  -p 3000:3000 \
  -e AWS_ACCESS_KEY_ID=your_access_key_id \
  -e AWS_SECRET_ACCESS_KEY=your_secret_access_key \
  -e AWS_REGION=us-east-1 \
  -e DATABASE_URL=your_database_url \
  -e JWT_SECRET=your_jwt_secret \
  -e HASURA_ADMIN_SECRET=your_hasura_admin_secret \
  rendasua-backend:latest
```

### Method 2: Using Docker Compose

```bash
# Start the service
docker-compose -f docker-compose.backend.yml up -d

# View logs
docker-compose -f docker-compose.backend.yml logs -f backend

# Stop the service
docker-compose -f docker-compose.backend.yml down
```

## Security Best Practices

### 1. Use AWS IAM Roles (Recommended for Production)

Instead of hardcoding AWS credentials, use IAM roles when running on AWS infrastructure:

```bash
# For EC2 instances, attach an IAM role
# For ECS/Fargate, use task roles
# For Kubernetes, use IAM roles for service accounts
```

### 2. Use Docker Secrets (Docker Swarm)

```bash
# Create secrets
echo "your_access_key_id" | docker secret create aws_access_key_id -
echo "your_secret_access_key" | docker secret create aws_secret_access_key -

# Use in docker-compose
version: '3.8'
services:
  backend:
    secrets:
      - aws_access_key_id
      - aws_secret_access_key
    environment:
      - AWS_ACCESS_KEY_ID_FILE=/run/secrets/aws_access_key_id
      - AWS_SECRET_ACCESS_KEY_FILE=/run/secrets/aws_secret_access_key
```

### 3. Use Environment Files

Create a `.env` file (never commit this to version control):

```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
```

### 4. Use AWS Parameter Store or Secrets Manager

For production environments, consider using AWS Systems Manager Parameter Store or AWS Secrets Manager.

## Environment Variables

The following environment variables are supported:

| Variable                | Description             | Required | Default      |
| ----------------------- | ----------------------- | -------- | ------------ |
| `AWS_ACCESS_KEY_ID`     | AWS Access Key ID       | Yes      | -            |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Access Key   | Yes      | -            |
| `AWS_REGION`            | AWS Region              | No       | `us-east-1`  |
| `NODE_ENV`              | Node.js environment     | No       | `production` |
| `PORT`                  | Application port        | No       | `3000`       |
| `HOST`                  | Application host        | No       | `0.0.0.0`    |
| `DATABASE_URL`          | Database connection URL | Yes      | -            |
| `JWT_SECRET`            | JWT signing secret      | Yes      | -            |
| `HASURA_ADMIN_SECRET`   | Hasura admin secret     | Yes      | -            |

## Health Check

The container includes a health check that verifies the application is running:

```bash
# Check container health
docker ps

# View health check logs
docker inspect rendasua-backend | grep -A 10 "Health"
```

## Troubleshooting

### Common Issues

1. **AWS Credentials Not Working**

   - Verify the credentials are correct
   - Check if the credentials have the necessary permissions
   - Ensure the AWS region is correct

2. **Container Won't Start**

   - Check the logs: `docker logs rendasua-backend`
   - Verify all required environment variables are set
   - Ensure the port 3000 is not already in use

3. **Permission Denied**
   - The container runs as a non-root user (nestjs)
   - Ensure proper file permissions in the build context

### Debugging

```bash
# Run container in interactive mode for debugging
docker run -it --rm \
  -p 3000:3000 \
  -e AWS_ACCESS_KEY_ID=your_access_key_id \
  -e AWS_SECRET_ACCESS_KEY=your_secret_access_key \
  rendasua-backend:latest /bin/sh

# View container logs
docker logs -f rendasua-backend

# Execute commands in running container
docker exec -it rendasua-backend /bin/sh
```

## Production Deployment

For production deployment, consider:

1. Using a reverse proxy (nginx, traefik)
2. Setting up SSL/TLS certificates
3. Implementing proper logging and monitoring
4. Using container orchestration (Kubernetes, Docker Swarm)
5. Setting up CI/CD pipelines
6. Using AWS ECS/Fargate or EKS for managed container services
