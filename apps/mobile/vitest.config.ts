import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Stub native modules that Rollup can't parse in a Node test env.
      'expo-crypto': path.resolve(__dirname, 'src/__mocks__/expo-crypto.ts'),
      'expo-secure-store': path.resolve(__dirname, 'src/__mocks__/expo-secure-store.ts'),
      '@react-native-async-storage/async-storage': path.resolve(
        __dirname,
        'src/__mocks__/@react-native-async-storage/async-storage.ts'
      ),
      'react-native': path.resolve(__dirname, 'src/__mocks__/react-native.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
    setupFiles: ['src/__mocks__/setup.ts'],
  },
});
