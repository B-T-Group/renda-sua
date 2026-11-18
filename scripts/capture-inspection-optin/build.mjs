import * as esbuild from 'esbuild';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const here = import.meta.dirname;
const webStub = path.join(here, 'web-stub.tsx');
const mobileApi = path.join(here, 'mobile-api.tsx');
const mobileNav = path.join(here, 'mobile-nav.tsx');
const codegen = path.join(root, 'scripts/capture-accept-start/codegen-stub.js');
const rnw = path.join(root, 'scripts/capture-accept-start/rn-shim.js');
const mobileNm = path.join(root, 'apps/mobile/node_modules');

const banner = `var process = { env: { NODE_ENV: "development", EXPO_OS: "web" } }; var global = globalThis;
globalThis.ErrorUtils = globalThis.ErrorUtils || { setGlobalHandler: function(){}, getGlobalHandler: function(){ return function(){}; }, reportFatalError: function(e){ console.error(e && e.stack ? e.stack : e); }, reportError: function(){} };
var __expoMod = new Proxy(function(){ return true; }, { get: function(){ return __expoMod; }, apply: function(){ return true; } });
globalThis.expo = { modules: new Proxy({}, { get: function(){ return __expoMod; } }) };`;

const WEB_STUBS = new Set([
  'useApiClient',
  'UserProfileContext',
  'SessionAuthContext',
  'useGraphQLClient',
  'MarketContext',
]);

export async function buildWeb(outfile) {
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['scripts/capture-inspection-optin/web-app.tsx'],
    bundle: true,
    outfile,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    legalComments: 'none',
    nodePaths: ['apps/frontend/node_modules', 'node_modules'],
    define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true' },
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl' },
    plugins: [
      {
        name: 'web-capture-stubs',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            const base = args.path.split('/').pop()?.replace(/\.(tsx|ts|js)$/, '') ?? '';
            if (WEB_STUBS.has(base)) return { path: webStub };
            if (args.path.endsWith('.css')) return { path: args.path, namespace: 'empty' };
            return null;
          });
          build.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
        },
      },
    ],
  });
}

function mobileStub(importPath) {
  if (importPath.includes('expo-image-picker')) return mobileApi;
  if (importPath.includes('@react-native-community/netinfo')) return mobileApi;
  if (importPath.includes('@react-native-async-storage/async-storage')) return mobileApi;
  if (importPath.includes('@react-navigation/elements')) return mobileApi;
  if (importPath.endsWith('/apiClient') || importPath.endsWith('/publicApiClient')) return mobileApi;
  if (importPath.includes('ClientFlagsContext')) return mobileApi;
  return null;
}

export async function buildMobile(outfile) {
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['scripts/capture-inspection-optin/mobile-app.tsx'],
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
            const navImporter = args.importer ?? '';
            const navFromUi = navImporter.includes('/screens/') || navImporter.includes('/components/');
            if (navFromUi && (args.path === '@react-navigation/native' || args.path.startsWith('@react-navigation/native/'))) {
              return { path: mobileNav };
            }
            const hit = mobileStub(args.path);
            if (hit) return { path: hit };
            if (args.path.endsWith('.css')) return { path: args.path, namespace: 'empty' };
            return null;
          });
          build.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
        },
      },
    ],
  });
}
