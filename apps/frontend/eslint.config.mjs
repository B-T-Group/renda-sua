import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['**/public/service-worker.js'],
    // Service workers use 'self' as the global scope (similar to 'window' in regular pages)
    rules: {
      'no-restricted-globals': 'off',
      '@typescript-eslint/no-restricted-globals': 'off',
      'no-undef': 'off',
    },
    languageOptions: {
      globals: {
        self: 'readonly',
        ServiceWorkerGlobalScope: 'readonly',
        indexedDB: 'readonly',
        IDBOpenDBRequest: 'readonly',
        IDBDatabase: 'readonly',
        IDBTransaction: 'readonly',
        IDBObjectStore: 'readonly',
        caches: 'readonly',
        CacheStorage: 'readonly',
        fetch: 'readonly',
        addEventListener: 'readonly',
        skipWaiting: 'readonly',
        clients: 'readonly',
      },
    },
  },
];
