import * as esbuild from 'esbuild';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const api = path.join(root, 'scripts/capture-accept-start/mobile-api.tsx');
const nav = path.join(root, 'scripts/capture-accept-start/mobile-nav.tsx');
const codegen = path.join(root, 'scripts/capture-accept-start/codegen-stub.js');
const rnw = path.join(root, 'scripts/capture-accept-start/rn-shim.js');
const mobileNm = path.join(root, 'apps/mobile/node_modules');

function stubFor(importPath, importer) {
  const base = importPath.split('/').pop() ?? '';
  if (
    base.startsWith('rentalsApi') ||
    base.startsWith('rentalInspectionApi') ||
    base === 'useIsStripeRail' ||
    base === 'useRentalStripePayment' ||
    importPath.includes('expo-image-picker') ||
    importPath.includes('stripe-react-native') ||
    importPath.includes('MaterialCommunityIcons') ||
    importPath.includes('@expo/vector-icons')
  ) {
    return api;
  }
  if (base.startsWith('ClientFlagsContext') || base.startsWith('RootStore')) return api;
  const inboxImporter = importer.includes('MessagesScreen');
  if (
    inboxImporter &&
    (base.startsWith('agentApi') ||
      base.startsWith('useThreads') ||
      base.startsWith('useProfileMe') ||
      base.startsWith('useNotificationNavigation'))
  ) {
    return api;
  }
  if (
    (importPath === '@react-navigation/native' || importPath.startsWith('@react-navigation/native/')) &&
    (importer.includes('/screens/') || importer.includes('/components/rentals/'))
  ) {
    return nav;
  }
  return null;
}

const banner = `var process = { env: { NODE_ENV: "development", EXPO_OS: "web" } }; var global = globalThis;
globalThis.ErrorUtils = globalThis.ErrorUtils || { setGlobalHandler: function(){}, getGlobalHandler: function(){ return function(){}; }, reportFatalError: function(e){ console.error(e && e.stack ? e.stack : e); }, reportError: function(){} };
globalThis.ExpoDomWebView = {};
var __expoMod = new Proxy(function(){ return Promise.resolve(null); }, { get: function(){ return __expoMod; }, apply: function(){ return Promise.resolve(null); } });
globalThis.expo = { modules: new Proxy({}, { get: function(){ return __expoMod; } }) };`;

export async function buildMobile(outfile, entry = 'scripts/capture-accept-start/mobile-app.tsx') {
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    outfile,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    legalComments: 'none',
    banner: { js: banner },
    nodePaths: ['apps/mobile/node_modules', 'node_modules'],
    define: {
      'process.env.NODE_ENV': '"development"',
      'process.env.EXPO_OS': '"web"',
      __DEV__: 'true',
    },
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.ttf': 'dataurl', '.wav': 'dataurl' },
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
          build.onResolve({ filter: /.*/ }, (args) => {
            const hit = stubFor(args.path, args.importer ?? '');
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
