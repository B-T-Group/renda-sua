import * as esbuild from 'esbuild';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

export async function buildWeb(outfile) {
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['scripts/capture-decline-ranking/web-app.tsx'],
    bundle: true,
    outfile,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    legalComments: 'none',
    nodePaths: ['apps/frontend/node_modules', 'node_modules'],
    define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true' },
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl' },
  });
}
