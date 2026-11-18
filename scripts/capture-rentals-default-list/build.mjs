import * as esbuild from 'esbuild';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const here = import.meta.dirname;
const mobileStub = path.join(here, 'mobile-stubs.tsx');
const webStub = path.join(here, 'web-stubs.tsx');
const rnw = path.join(root, 'scripts/capture-accept-start/rn-shim.js');
const codegen = path.join(root, 'scripts/capture-accept-start/codegen-stub.js');
const mobileNm = path.join(root, 'apps/mobile/node_modules');

const banner = `var process = { env: { NODE_ENV: "development", EXPO_OS: "web" } }; var global = globalThis;
globalThis.ErrorUtils = globalThis.ErrorUtils || { setGlobalHandler: function(){}, getGlobalHandler: function(){ return function(){}; }, reportFatalError: function(e){ console.error(e && e.stack ? e.stack : e); }, reportError: function(){} };
var __expoMod = new Proxy(function(){ return true; }, { get: function(){ return __expoMod; }, apply: function(){ return true; } });
globalThis.expo = { modules: new Proxy({}, { get: function(){ return __expoMod; } }) };`;

function emptyCss(build) {
  build.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
}

export async function buildMobile(outfile) {
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['scripts/capture-rentals-default-list/mobile-app.tsx'],
    bundle: true,
    outfile,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    legalComments: 'none',
    banner: { js: banner },
    nodePaths: ['apps/mobile/node_modules', 'node_modules'],
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.EXPO_OS': '"web"', __DEV__: 'true' },
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.ttf': 'dataurl', '.js': 'jsx' },
    alias: {
      '@': path.join(root, 'apps/mobile/src'),
      react: path.join(mobileNm, 'react'),
      'react-dom': path.join(mobileNm, 'react-dom'),
    },
    plugins: [
      {
        name: 'mobile-capture-stubs',
        setup(build) {
          build.onResolve({ filter: /^react-native$/ }, () => ({ path: rnw }));
          build.onResolve({ filter: /codegenNativeComponent$/ }, () => ({ path: codegen }));
          build.onResolve({ filter: /.*/ }, (args) => {
            const spec = args.path;
            if (spec === '@react-native-async-storage/async-storage') return { path: mobileStub };
            if (spec === '@react-navigation/bottom-tabs' || spec.startsWith('@react-navigation/bottom-tabs/')) return { path: mobileStub };
            if (spec === 'expo-localization') return { path: mobileStub };
            if (spec.endsWith('/ClientFlagsContext') || spec.endsWith('/useMarket') || spec.endsWith('/RootStore') || spec.endsWith('/publicApiClient')) {
              return { path: mobileStub };
            }
            if (spec.endsWith('.css')) return { path: spec, namespace: 'empty' };
            return null;
          });
          emptyCss(build);
        },
      },
    ],
  });
}

export async function buildWeb(outfile) {
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['scripts/capture-rentals-default-list/web-app.tsx'],
    bundle: true,
    outfile,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    legalComments: 'none',
    banner: { js: 'var process = { env: { NODE_ENV: "development" } }; var global = globalThis;' },
    nodePaths: ['apps/frontend/node_modules', 'node_modules'],
    define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true' },
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl' },
    plugins: [
      {
        name: 'web-capture-stubs',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            const spec = args.path;
            if (spec.endsWith('/useApiClient') || spec.endsWith('/useClientFlags') || spec.endsWith('/MarketContext')) {
              return { path: webStub };
            }
            if (spec.includes('/i18n') && spec.endsWith('/i18n')) return { path: webStub };
            if (spec.endsWith('.css')) return { path: spec, namespace: 'empty' };
            return null;
          });
          emptyCss(build);
        },
      },
    ],
  });
}
