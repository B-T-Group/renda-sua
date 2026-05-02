import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react-swc';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv } from 'vite';
import compression from 'vite-plugin-compression';

const dir = path.dirname(fileURLToPath(import.meta.url));

function chunkStrategy(id: string): string | undefined {
  if (!id.includes('node_modules')) return;
  if (id.includes('@mui/x-data-grid')) return 'mui-datagrid';
  if (id.includes('@mui/icons-material')) return 'mui-icons';
  if (
    id.match(
      /@mui\/(material|lab|system|x-date-pickers|x-date-pickers-pro)|@emotion/
    )
  )
    return 'mui';
  if (id.includes('@fullcalendar')) return 'fullcalendar';
  if (id.includes('react-pdf') || id.includes('pdfjs-dist')) return 'pdf';
  if (id.includes('country-state-city') || id.includes('country-to-currency'))
    return 'countries';
  if (id.includes('google-libphonenumber')) return 'phone';
  if (id.includes('@auth0')) return 'auth0';
  if (id.match(/i18next|react-i18next/)) return 'i18n';
  if (id.match(/apollo|graphql/)) return 'graphql';
  if (id.match(/react-router/)) return 'router';
  if (id.match(/react-dom|scheduler|^react$|\/react\//)) return 'react';
  return undefined;
}

function environmentAlias(mode: string): Record<string, string> {
  const base = path.resolve(dir, 'src/config/environment.ts');
  if (mode === 'production') {
    return {
      [base]: path.resolve(dir, 'src/config/environment.production.ts'),
    };
  }
  if (mode === 'development') {
    return {
      [base]: path.resolve(dir, 'src/config/environment.development.ts'),
    };
  }
  return {};
}

export default defineConfig(({ mode }) => {
  const workspaceRoot = path.resolve(dir, '../..');
  const env = loadEnv(mode, workspaceRoot, ['REACT_APP_', 'HASURA_', 'NODE_']);
  const defineEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    defineEnv[`process.env.${k}`] = JSON.stringify(v ?? '');
  }

  return {
    root: dir,
    cacheDir: path.join(workspaceRoot, 'node_modules/.vite/apps/frontend'),
    publicDir: 'public',
    server: { port: 4200, host: 'localhost', open: true },
    preview: { port: 4200 },
    plugins: [
      react(),
      nxViteTsPaths(),
      nxCopyAssetsPlugin([
        { input: 'src', glob: 'favicon.ico', output: '.' },
        'src/assets',
      ]),
      compression({
        algorithm: 'brotliCompress',
        ext: '.br',
        filter: /\.(js|mjs|json|css|html)$/,
        verbose: false,
      }),
      compression({
        algorithm: 'gzip',
        ext: '.gz',
        filter: /\.(js|mjs|json|css|html)$/,
        verbose: false,
      }),
      process.env['ANALYZE']
        ? visualizer({
            filename: path.join(
              workspaceRoot,
              'dist/apps/frontend/stats.html'
            ),
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          })
        : undefined,
    ].filter(Boolean),
    resolve: {
      alias: environmentAlias(mode),
    },
    define: {
      ...defineEnv,
      'process.env.NODE_ENV': JSON.stringify(
        mode === 'production' ? 'production' : 'development'
      ),
    },
    build: {
      outDir: '../../dist/apps/frontend',
      emptyOutDir: true,
      target: 'es2020',
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: chunkStrategy,
        },
      },
    },
  };
});
