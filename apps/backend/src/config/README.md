# Configuration Setup

This directory contains the configuration setup for the NestJS backend application using `@nestjs/config`.

## Overview

The application uses a global ConfigModule that reads configuration from environment variables and provides type-safe access to configuration values.

## Files

- `configuration.ts` - Main configuration file with type definitions and default values
- `env.example` - Template for environment variables (copy to `.env`)

## Configuration Structure

The configuration is organized into logical sections:

### App Configuration

- `port` - Application port (default: 3000)
- `nodeEnv` - Node environment (default: development)
- `logLevel` - Logging level (default: debug)

### Database Configuration

- `url` - Database connection string

### Hasura Configuration

- `endpoint` - Hasura GraphQL endpoint
- `adminSecret` - Hasura admin secret

### AWS Configuration

- `region` - AWS region
- `accessKeyId` - AWS access key ID
- `secretAccessKey` - AWS secret access key
- `s3BucketName` - S3 bucket name (optional)
- `s3BucketRegion` - S3 bucket region (optional)

### JWT Configuration

- `secret` - JWT secret key
- `expiresIn` - JWT expiration time

### CORS Configuration

- `origin` - CORS origin

### Email Configuration

- `host` - SMTP host
- `port` - SMTP port
- `user` - SMTP username
- `pass` - SMTP password

### Redis Configuration

- `host` - Redis host
- `port` - Redis port
- `password` - Redis password (optional)

### External API Configuration

- `googleMapsApiKey` - Google Maps API key (optional)
- `stripeSecretKey` - Stripe secret key (optional)
- `stripePublishableKey` - Stripe publishable key (optional)

## Usage

### In Services

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../config/configuration';

@Injectable()
export class MyService {
  constructor(private readonly configService: ConfigService<Configuration>) {
    // Access typed configuration
    const appConfig = this.configService.get('app');
    const awsConfig = this.configService.get('aws');

    // Access specific values
    const port = this.configService.get('app.port');
    const region = this.configService.get('aws.region');
  }
}
```

### Environment Variables

Copy `env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```

The application will load environment variables from the following files in order:

1. `.env.local`
2. `.env.development` (if NODE_ENV=development)
3. `.env.production` (if NODE_ENV=production)
4. `.env`

## Features

- **Type Safety**: Full TypeScript support with typed configuration
- **Global Access**: ConfigModule is global, accessible throughout the application
- **Environment-Specific**: Different .env files for different environments
- **Variable Expansion**: Support for variable expansion in .env files
- **Caching**: Configuration is cached for performance
- **Validation**: Type-safe access prevents runtime errors

## Security Notes

- Never commit `.env` files to version control
- Use strong, unique secrets for production
- Rotate API keys regularly
- Use environment-specific configurations
- Consider using a secrets management service for production
