/**
 * Bundles the real request UI for screenshots.
 * This file is not imported by App.tsx, index.js, or the web entry.
 */
import * as esbuild from 'esbuild';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const here = import.meta.dirname;
const webI18n = path.join(here, 'web-i18n.ts');
const mobileI18n = path.join(here, 'mobile-i18n.ts');
const webStubs = path.join(here, 'web-stubs.tsx');
const mobileStubs = path.join(here, 'mobile-stubs.tsx');
const fontStub = path.join(here, 'font-stub.js');
const rnw = path.join(root, 'scripts/capture-accept-start/rn-shim.js');
const codegen = path.join(root, 'scripts/capture-accept-start/codegen-stub.js');
const mobileNm = path.join(root, 'apps/mobile/node_modules');

function isI18n(resolved) {
  const webDir = path.join(root, 'apps/frontend/src/i18n');
  const mobileDir = path.join(root, 'apps/mobile/src/i18n');
  if (resolved === webDir || resolved.startsWith(webDir + path.sep)) return webI18n;
  if (resolved === mobileDir || resolved.startsWith(mobileDir + path.sep)) return mobileI18n;
  return null;
}

function stubFor(args) {
  if (args.path === 'react-native') return rnw;
  if (args.path.includes('codegenNativeComponent')) return codegen;
  const importer = args.importer || '';
  const inApp = importer.includes(`${path.sep}apps${path.sep}mobile${path.sep}src${path.sep}`);
  const inTheme = importer.includes(`${path.sep}theme${path.sep}`);
  if (inApp && !inTheme && (args.path === '@react-navigation/native' || args.path.startsWith('@react-navigation/native/'))) {
    return mobileStubs;
  }
  if (args.path === 'expo-font' || args.path.startsWith('expo-font/')) return fontStub;
  const resolved = args.path.startsWith('.')
    ? path.resolve(path.dirname(args.importer || ''), args.path)
    : args.path;
  const i18n = isI18n(resolved);
  if (i18n) return i18n;
  const base = path.basename(resolved).replace(/\.(tsx|ts|jsx|js)$/, '');
  if (['useClientFlags', 'useRentalApi', 'useApiClient', 'useTrackSiteEvent', 'UserProfileContext'].includes(base)) {
    return webStubs;
  }
  if (['ClientFlagsContext', 'rentalsApi', 'apiClient', 'AppEventsService', 'useMainTabContentBottomPadding', 'tabBarGeometry'].includes(base)) {
    return mobileStubs;
  }
  return null;
}

function plugin() {
  return {
    name: 'capture-dashboard-rental-requests',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.importer?.includes('capture-dashboard-rental-requests')) {
          if (args.path === 'react-native') return { path: rnw };
          return null;
        }
        const hit = stubFor(args);
        if (hit) return { path: hit };
        if (args.path.endsWith('.css')) return { path: args.path, namespace: 'empty' };
        return null;
      });
      build.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
    },
  };
}

const shared = {
  absWorkingDir: root,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  legalComments: 'none',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl' },
  plugins: [plugin()],
};

export async function buildWeb(outfile) {
  await esbuild.build({
    ...shared,
    entryPoints: ['scripts/capture-dashboard-rental-requests/web-app.tsx'],
    outfile,
    nodePaths: ['apps/frontend/node_modules', 'node_modules'],
    define: { 'process.env.NODE_ENV': '"production"' },
    banner: { js: 'var process = { env: { NODE_ENV: "production" } };' },
  });
}

export async function buildMobile(outfile) {
  await esbuild.build({
    ...shared,
    entryPoints: ['scripts/capture-dashboard-rental-requests/mobile-app.tsx'],
    outfile,
    nodePaths: ['apps/mobile/node_modules', 'node_modules'],
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.ttf': 'dataurl', '.js': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false' },
    alias: { react: path.join(mobileNm, 'react'), 'react-dom': path.join(mobileNm, 'react-dom') },
    banner: {
      js: `var process = { env: { NODE_ENV: "production", EXPO_OS: "web" } }; var global = globalThis;
globalThis.ErrorUtils = globalThis.ErrorUtils || { setGlobalHandler: function(){}, getGlobalHandler: function(){ return function(){}; }, reportFatalError: function(e){ console.error(e && e.stack ? e.stack : e); }, reportError: function(){} };
globalThis.expo = { modules: new Proxy({}, { get: function(){ return function(){ return Promise.resolve(null); }; } }) };`,
    },
  });
}
