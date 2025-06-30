#!/usr/bin/env node

/**
 * Test script to verify webpack environment loading
 * This simulates the webpack environment file selection logic
 */

const fs = require('fs');
const path = require('path');

// Simulate the webpack getEnvFilePath function
const getEnvFilePath = (nodeEnv = 'development') => {
  console.log(`Testing environment file selection for NODE_ENV: ${nodeEnv}`);

  // Define environment file paths in order of precedence
  const envFiles = [
    `.env.${nodeEnv}.local`,
    `.env.${nodeEnv}`,
    '.env.local',
    '.env',
  ];

  console.log('Checking files in order:');

  // Find the first existing environment file
  for (const envFile of envFiles) {
    const envPath = path.join(__dirname, envFile);
    console.log(
      `  - ${envFile}: ${fs.existsSync(envPath) ? 'EXISTS' : 'NOT FOUND'}`
    );

    if (fs.existsSync(envPath)) {
      console.log(`✓ Selected: ${envFile}`);
      return envFile;
    }
  }

  console.log('✗ No environment file found');
  return null;
};

// Test different environments
const environments = ['development', 'staging', 'production'];

console.log('=== Webpack Environment File Selection Test ===\n');

environments.forEach((env) => {
  console.log(`\n--- Testing ${env.toUpperCase()} ---`);
  const selectedFile = getEnvFilePath(env);

  if (selectedFile) {
    const envPath = path.join(__dirname, selectedFile);
    const content = fs.readFileSync(envPath, 'utf8');

    // Extract and display some key variables
    const lines = content.split('\n');
    const hasuraUrl = lines.find((line) =>
      line.includes('REACT_APP_HASURA_URL')
    );
    const backendUrl = lines.find((line) =>
      line.includes('REACT_APP_BACKEND_URL')
    );
    const debugMode = lines.find((line) =>
      line.includes('REACT_APP_ENABLE_DEBUG_MODE')
    );

    console.log('\nKey variables from selected file:');
    if (hasuraUrl) console.log(`  ${hasuraUrl.trim()}`);
    if (backendUrl) console.log(`  ${backendUrl.trim()}`);
    if (debugMode) console.log(`  ${debugMode.trim()}`);
  }

  console.log('---');
});

console.log('\n=== Test Complete ===');
console.log(
  '\nThis simulates what webpack will do when building for different environments.'
);
console.log(
  'The actual webpack build will use the same logic to select environment files.'
);
