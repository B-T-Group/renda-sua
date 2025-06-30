# Environment Configuration for Frontend Deployment

This document explains how to use different environment variables during deployment for the Rendasua frontend application.

## Overview

The frontend application now supports multiple environment configurations through different `.env` files and dynamic webpack configuration. This allows you to use different settings for development, staging, and production deployments.

## Environment Files

The application supports the following environment files (in order of precedence):

1. `.env.{NODE_ENV}.local` - Local overrides for specific environment
2. `.env.{NODE_ENV}` - Environment-specific configuration
3. `.env.local` - Local overrides (always loaded)
4. `.env` - Default configuration

### Available Environment Files

- `.env` - Default development configuration
- `.env.development` - Development environment
- `.env.staging` - Staging environment
- `.env.production` - Production environment

## Usage

### Development

```bash
# Use default .env file
npm run dev:frontend

# Explicitly use development environment
NODE_ENV=development npm run dev:frontend
# or
npm run serve:development
```

### Staging Build

```bash
# Build for staging
NODE_ENV=staging npm run build:frontend
# or
npm run build:staging
```

### Production Build

```bash
# Build for production
NODE_ENV=production npm run build:frontend
# or
npm run build:production
```

## Environment Validation

### Validate All Environments

```bash
# Validate current environment
npm run validate-env

# Validate specific environments
npm run validate-env:development
npm run validate-env:staging
npm run validate-env:production
```

### Validation Features

- Checks for required environment variables
- Validates URL formats
- Environment-specific warnings (e.g., debug mode in production)
- Reports missing or empty variables

## Webpack Configuration

The webpack configuration automatically selects the correct environment file based on `NODE_ENV`:

```javascript
const getEnvFilePath = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  const envFiles = [
    `.env.${nodeEnv}.local`,
    `.env.${nodeEnv}`,
    '.env.local',
    '.env',
  ];

  // Find the first existing environment file
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      return envFile;
    }
  }
  
  return null;
};
```

## Deployment Examples

### Local Development

```bash
# Start development server with default .env
npm run dev:frontend
```

### Staging Deployment

```bash
# Validate staging environment
npm run validate-env:staging

# Build for staging
npm run build:staging

# Deploy the dist/apps/frontend directory
```

### Production Deployment

```bash
# Validate production environment
npm run validate-env:production

# Build for production
npm run build:production

# Deploy the dist/apps/frontend directory
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Frontend

on:
  push:
    branches: [main, staging]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Validate environment
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            npm run validate-env:production
          else
            npm run validate-env:staging
          fi
      
      - name: Build frontend
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            npm run build:frontend:production
          else
            npm run build:frontend:staging
          fi
      
      - name: Deploy to hosting
        run: |
          # Deploy dist/apps/frontend to your hosting service
```

### Environment Variables in CI/CD

For sensitive values, use CI/CD secrets:

```yaml
- name: Build with secrets
  env:
    REACT_APP_AUTH0_DOMAIN: ${{ secrets.AUTH0_DOMAIN }}
    REACT_APP_AUTH0_CLIENT_ID: ${{ secrets.AUTH0_CLIENT_ID }}
    REACT_APP_AUTH0_AUDIENCE: ${{ secrets.AUTH0_AUDIENCE }}
  run: npm run build:production
```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_HASURA_URL` | Hasura GraphQL endpoint | `https://hasura.example.com/v1/graphql` |
| `REACT_APP_AUTH0_DOMAIN` | Auth0 domain | `your-domain.auth0.com` |
| `REACT_APP_AUTH0_CLIENT_ID` | Auth0 client ID | `your-client-id` |
| `REACT_APP_AUTH0_AUDIENCE` | Auth0 audience | `https://api.example.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | Backend API URL | `http://localhost:3000` |
| `REACT_APP_ENABLE_DEBUG_MODE` | Enable debug logging | `false` |
| `REACT_APP_ENABLE_ANALYTICS` | Enable analytics | `false` |
| `REACT_APP_DEFAULT_LOCALE` | Default language | `en` |
| `REACT_APP_SUPPORTED_LOCALES` | Supported languages | `en,fr` |
| `REACT_APP_ENABLE_HOT_RELOAD` | Enable hot reload | `true` |
| `REACT_APP_ENABLE_SOURCE_MAPS` | Enable source maps | `true` |

## Best Practices

1. **Never commit sensitive values** to version control
2. **Use CI/CD secrets** for production credentials
3. **Validate environments** before deployment
4. **Keep environment files** in sync with `.env.example`
5. **Test all environments** before deployment

## Troubleshooting

### Environment Not Loading

1. Check that `NODE_ENV` is set correctly
2. Verify the environment file exists
3. Restart the development server
4. Check webpack console output for loading messages

### Build Issues

1. Run environment validation first
2. Check for missing required variables
3. Verify file paths and permissions
4. Review webpack configuration

### Deployment Issues

1. Ensure the correct `NODE_ENV` is set during build
2. Validate the target environment configuration
3. Check that all required variables are set
4. Verify the build output is correct
