# Frontend Environment Configuration

This document describes how to configure environment variables for the Rendasua frontend application.

## Overview

The frontend application uses environment variables to configure various services and features. Environment variables are loaded from `.env` files using `dotenv-webpack`.

## Setup

### 1. Environment Files

The application supports the following environment files (in order of precedence):

- `.env.local` - Local environment variables (not committed to git)
- `.env.development` - Development environment variables
- `.env.production` - Production environment variables
- `.env` - Default environment variables

### 2. Creating Your Environment File

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your configuration values.

## Environment Variables

### Required Variables

| Variable                    | Description             | Example                            |
| --------------------------- | ----------------------- | ---------------------------------- |
| `REACT_APP_HASURA_URL`      | Hasura GraphQL endpoint | `http://localhost:8080/v1/graphql` |
| `REACT_APP_AUTH0_DOMAIN`    | Auth0 domain            | `your-domain.auth0.com`            |
| `REACT_APP_AUTH0_CLIENT_ID` | Auth0 client ID         | `your-client-id`                   |
| `REACT_APP_AUTH0_AUDIENCE`  | Auth0 audience          | `your-audience`                    |

### Optional Variables

| Variable                       | Description          | Default                 | Example                    |
| ------------------------------ | -------------------- | ----------------------- | -------------------------- |
| `REACT_APP_BACKEND_URL`        | Backend API URL      | `http://localhost:3000` | `https://api.rendasua.com` |
| `REACT_APP_ENABLE_DEBUG_MODE`  | Enable debug logging | `false`                 | `true`                     |
| `REACT_APP_ENABLE_ANALYTICS`   | Enable analytics     | `false`                 | `true`                     |
| `REACT_APP_DEFAULT_LOCALE`     | Default language     | `en`                    | `fr`                       |
| `REACT_APP_SUPPORTED_LOCALES`  | Supported languages  | `en,fr`                 | `en,fr,es`                 |
| `REACT_APP_ENABLE_HOT_RELOAD`  | Enable hot reload    | `true`                  | `false`                    |
| `REACT_APP_ENABLE_SOURCE_MAPS` | Enable source maps   | `true`                  | `false`                    |

### AWS Configuration (Optional)

| Variable                  | Description    | Example            |
| ------------------------- | -------------- | ------------------ |
| `REACT_APP_AWS_REGION`    | AWS region     | `us-east-1`        |
| `REACT_APP_AWS_S3_BUCKET` | S3 bucket name | `rendasua-uploads` |

## Usage in Code

### Importing Environment Configuration

```typescript
import { environment } from '../config/environment';

// Access environment variables
console.log(environment.hasuraUrl);
console.log(environment.auth0.domain);
console.log(environment.isDevelopment);
```

### Available Properties

```typescript
interface Environment {
  hasuraUrl: string;
  backendUrl: string;
  auth0: {
    domain: string;
    clientId: string;
    audience: string;
  };
  isDevelopment: boolean;
  enableDebugMode: boolean;
  enableAnalytics: boolean;
  i18n: {
    defaultLocale: string;
    supportedLocales: string[];
  };
  development: {
    enableHotReload: boolean;
    enableSourceMaps: boolean;
  };
}
```

## Development vs Production

### Development Environment

For development, you typically want:

```env
REACT_APP_ENABLE_DEBUG_MODE=true
REACT_APP_ENABLE_HOT_RELOAD=true
REACT_APP_ENABLE_SOURCE_MAPS=true
REACT_APP_HASURA_URL=http://localhost:8080/v1/graphql
REACT_APP_BACKEND_URL=http://localhost:3000
```

### Production Environment

For production, you typically want:

```env
REACT_APP_ENABLE_DEBUG_MODE=false
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_HASURA_URL=https://hasura.rendasua.com/v1/graphql
REACT_APP_BACKEND_URL=https://api.rendasua.com
```

## Security Notes

1. **Never commit `.env` files** containing sensitive information to version control
2. **Use `.env.example`** to document required variables without exposing values
3. **Prefix variables with `REACT_APP_`** to make them available in the browser
4. **Validate environment variables** at runtime to catch configuration errors

## Troubleshooting

### Environment Variables Not Loading

1. Check that variables are prefixed with `REACT_APP_`
2. Restart the development server after changing `.env` files
3. Verify the `.env` file is in the correct location (`apps/frontend/.env`)

### Debug Environment Configuration

Enable debug mode to see loaded environment variables:

```env
REACT_APP_ENABLE_DEBUG_MODE=true
```

This will log the environment configuration to the console.

### Common Issues

1. **Variables not available**: Ensure they start with `REACT_APP_`
2. **Wrong values**: Check for typos in variable names
3. **Build issues**: Restart the development server after changes

## Example Configuration

### Complete `.env` Example

```env
# Hasura GraphQL endpoint
REACT_APP_HASURA_URL=http://localhost:8080/v1/graphql

# Auth0 Configuration
REACT_APP_AUTH0_DOMAIN=your-domain.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your-client-id
REACT_APP_AUTH0_AUDIENCE=your-audience

# Backend API URL
REACT_APP_BACKEND_URL=http://localhost:3000

# Feature flags
REACT_APP_ENABLE_DEBUG_MODE=true
REACT_APP_ENABLE_ANALYTICS=false

# Internationalization
REACT_APP_DEFAULT_LOCALE=en
REACT_APP_SUPPORTED_LOCALES=en,fr

# Development settings
REACT_APP_ENABLE_HOT_RELOAD=true
REACT_APP_ENABLE_SOURCE_MAPS=true
```

## Build Configuration

The environment variables are processed during the build process using `dotenv-webpack`. The configuration is in `webpack.config.js`:

```javascript
new Dotenv({
  path: './.env',
  safe: false,
  systemvars: true,
  silent: false,
  defaults: false,
}),
```

This ensures that environment variables are available at runtime in the browser.
