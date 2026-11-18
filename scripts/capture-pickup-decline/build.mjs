import * as esbuild from 'esbuild';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const here = import.meta.dirname;
const rnw = path.join(root, 'scripts/capture-accept-start/rn-shim.js');
const codegen = path.join(root, 'scripts/capture-accept-start/codegen-stub.js');
const fontStub = path.join(here, 'expo-font-stub.js');
const mobileNm = path.join(root, 'apps/mobile/node_modules');

const banner = `var process = { env: { NODE_ENV: "development", EXPO_OS: "web" } }; var global = globalThis;`;

export async function buildWeb(outfile) {
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['scripts/capture-pickup-decline/web-app.tsx'],
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

export async function buildMobile(outfile) {
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['scripts/capture-pickup-decline/mobile-app.tsx'],
    bundle: true,
    outfile,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    legalComments: 'none',
    banner: { js: banner },
    nodePaths: ['apps/mobile/node_modules', 'node_modules'],
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.EXPO_OS': '"web"', __DEV__: 'true' },
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl', '.ttf': 'dataurl', '.js': 'jsx' },
    alias: {
      react: path.join(mobileNm, 'react'),
      'react-dom': path.join(mobileNm, 'react-dom'),
    },
    plugins: [
      {
        name: 'mobile-capture-stubs',
        setup(build) {
          build.onResolve({ filter: /^react-native$/ }, () => ({ path: rnw }));
          build.onResolve({ filter: /codegenNativeComponent$/ }, () => ({ path: codegen }));
          build.onResolve({ filter: /^expo-font$/ }, () => ({ path: fontStub }));
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.path.endsWith('.css')) return { path: args.path, namespace: 'empty' };
            return null;
          });
          build.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
        },
      },
    ],
  });
}
