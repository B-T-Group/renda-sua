/* eslint-disable */
import { readFileSync } from 'fs';

// Specs run in UTC whatever the host timezone, so local-time math (e.g. the
// Nov 1 DST change in America/Toronto) can't shift expectations. Set here,
// before Jest spawns workers, so every worker inherits it.
process.env.TZ = 'UTC';

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8')
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

export default {
  displayName: '@rendasua/backend',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig]
  },
  transformIgnorePatterns: ['node_modules/(?!(graphql-request)/)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  coverageDirectory: 'test-output/jest/coverage'
};
