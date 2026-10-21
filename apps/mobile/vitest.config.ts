import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Stub native modules that Rollup can't parse in a Node test env.
      // Kept in src/test-stubs (not __mocks__) so Jest does not auto-apply them.
      'expo-crypto': path.resolve(__dirname, 'src/test-stubs/expo-crypto.ts'),
      'expo-secure-store': path.resolve(__dirname, 'src/test-stubs/expo-secure-store.ts'),
      '@react-native-async-storage/async-storage': path.resolve(
        __dirname,
        'src/test-stubs/async-storage.ts'
      ),
      'react-native': path.resolve(__dirname, 'src/test-stubs/react-native.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.render.test.tsx'],
    globals: true,
    setupFiles: ['src/__mocks__/setup.ts'],
  },
});
