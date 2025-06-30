#!/usr/bin/env node

/**
 * Environment Validation Script
 * Validates that required environment variables are set
 * Usage: node scripts/validate-env.js [environment]
 * Examples:
 *   node scripts/validate-env.js
 *   node scripts/validate-env.js production
 *   node scripts/validate-env.js staging
 *   node scripts/validate-env.js development
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) =>
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) =>
    console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
};

// Required environment variables
const requiredVars = [
  'REACT_APP_HASURA_URL',
  'REACT_APP_AUTH0_DOMAIN',
  'REACT_APP_AUTH0_CLIENT_ID',
  'REACT_APP_AUTH0_AUDIENCE',
];

// Optional environment variables with defaults
const optionalVars = [
  'REACT_APP_BACKEND_URL',
  'REACT_APP_ENABLE_DEBUG_MODE',
  'REACT_APP_ENABLE_ANALYTICS',
  'REACT_APP_DEFAULT_LOCALE',
  'REACT_APP_SUPPORTED_LOCALES',
  'REACT_APP_ENABLE_HOT_RELOAD',
  'REACT_APP_ENABLE_SOURCE_MAPS',
  'REACT_APP_AWS_REGION',
  'REACT_APP_AWS_S3_BUCKET',
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key] = valueParts.join('=');
      }
    }
  });

  return env;
}

function validateEnvironment(targetEnv = null) {
  const nodeEnv = targetEnv || process.env.NODE_ENV || 'development';
  log.info(`Validating environment configuration for: ${nodeEnv}`);

  // Define environment file paths in order of precedence (same as webpack)
  const envFiles = [
    `.env.${nodeEnv}.local`,
    `.env.${nodeEnv}`,
    '.env.local',
    '.env',
  ];

  let env = {};
  let loadedFile = null;

  for (const file of envFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      const fileEnv = loadEnvFile(filePath);
      env = { ...env, ...fileEnv };
      loadedFile = file;
      log.info(`Loaded environment from ${file}`);
    }
  }

  if (!loadedFile) {
    log.error(`No environment file found for ${nodeEnv}!`);
    log.info('Please create one of the following files:');
    envFiles.forEach((file) => log.info(`  - ${file}`));
    process.exit(1);
  }

  // Validate required variables
  const missingVars = [];
  const emptyVars = [];

  for (const varName of requiredVars) {
    if (!(varName in env)) {
      missingVars.push(varName);
    } else if (!env[varName]) {
      emptyVars.push(varName);
    }
  }

  // Check for missing variables
  if (missingVars.length > 0) {
    log.error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
    process.exit(1);
  }

  // Check for empty variables
  if (emptyVars.length > 0) {
    log.warning(
      `Empty required environment variables: ${emptyVars.join(', ')}`
    );
    log.info('These variables should be set with actual values');
  }

  // Report optional variables
  const setOptionalVars = optionalVars.filter((varName) => env[varName]);
  if (setOptionalVars.length > 0) {
    log.info(`Optional variables set: ${setOptionalVars.join(', ')}`);
  }

  // Validate specific values
  const warnings = [];

  // Check Hasura URL format
  if (
    env.REACT_APP_HASURA_URL &&
    !env.REACT_APP_HASURA_URL.includes('/v1/graphql')
  ) {
    warnings.push('REACT_APP_HASURA_URL should end with /v1/graphql');
  }

  // Check Auth0 domain format
  if (
    env.REACT_APP_AUTH0_DOMAIN &&
    !env.REACT_APP_AUTH0_DOMAIN.includes('.auth0.com')
  ) {
    warnings.push(
      'REACT_APP_AUTH0_DOMAIN should be in format: your-domain.auth0.com'
    );
  }

  // Check locale format
  if (
    env.REACT_APP_SUPPORTED_LOCALES &&
    !env.REACT_APP_SUPPORTED_LOCALES.includes(
      env.REACT_APP_DEFAULT_LOCALE || 'en'
    )
  ) {
    warnings.push(
      'REACT_APP_DEFAULT_LOCALE should be included in REACT_APP_SUPPORTED_LOCALES'
    );
  }

  // Environment-specific validations
  if (nodeEnv === 'production') {
    if (env.REACT_APP_ENABLE_DEBUG_MODE === 'true') {
      warnings.push(
        'REACT_APP_ENABLE_DEBUG_MODE should be false in production'
      );
    }
    if (env.REACT_APP_ENABLE_HOT_RELOAD === 'true') {
      warnings.push(
        'REACT_APP_ENABLE_HOT_RELOAD should be false in production'
      );
    }
    if (env.REACT_APP_ENABLE_SOURCE_MAPS === 'true') {
      warnings.push(
        'REACT_APP_ENABLE_SOURCE_MAPS should be false in production'
      );
    }
  }

  // Report warnings
  if (warnings.length > 0) {
    log.warning('Configuration warnings:');
    warnings.forEach((warning) => log.warning(`  - ${warning}`));
  }

  // Success message
  log.success(`Environment validation completed for ${nodeEnv}!`);

  if (emptyVars.length === 0 && warnings.length === 0) {
    log.success('All required variables are properly configured.');
  } else {
    log.info(
      'Please review the warnings above and update your configuration as needed.'
    );
  }

  return env;
}

// Run validation if script is executed directly
if (require.main === module) {
  try {
    const targetEnv = process.argv[2]; // Get environment from command line argument
    validateEnvironment(targetEnv);
  } catch (error) {
    log.error(`Validation failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { validateEnvironment };
