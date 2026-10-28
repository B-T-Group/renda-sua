#!/usr/bin/env node
/**
 * OTA safety check: native dependencies vs. the last store-binary baseline.
 *
 * An OTA update only ships JS. If apps/mobile/package.json gained a dependency
 * with native code after the last store build (the baseline), an OTA bundle that
 * imports it can throw at startup on devices running that binary, and expo-updates
 * silently falls back to the embedded bundle.
 *
 * native-deps-baseline.json holds:
 *   - baselineCommit / baselineBuild: the commit the store binary was built from
 *   - dependencies: name -> version of package.json "dependencies" at that commit
 *   - guardedAllowlist: name -> file that wraps it in a lazy try/catch require
 *
 * A dependency that is NOT in the baseline and NOT in guardedAllowlist is an
 * error (exit 1) when it looks native, or when node_modules is not installed so
 * it cannot be classified. JS-only new deps and version drift only warn.
 *
 * Usage:
 *   node scripts/check-native-deps.js                 # check (CI / OTA deploy)
 *   node scripts/check-native-deps.js --warn-only     # never fail (PR CI)
 *   node scripts/check-native-deps.js --update-baseline <commit> [<build>]
 *       # after shipping a NEW native build: re-snapshot package.json deps,
 *       # clears the allowlist.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'native-deps-baseline.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');

function findPackageDir(name, fromDir) {
  // Search the app's and the (hoisted) workspace root's node_modules.
  const candidates = [
    path.join(fromDir, 'node_modules', name),
    path.join(fromDir, '..', '..', 'node_modules', name),
  ];
  return candidates.find((c) => fs.existsSync(path.join(c, 'package.json'))) || null;
}

/** true = native, false = JS-only, null = unknown (not installed). */
function isNativePackage(name, fromDir = ROOT) {
  const dir = findPackageDir(name, fromDir);
  if (!dir) return null;
  if (fs.existsSync(path.join(dir, 'ios')) || fs.existsSync(path.join(dir, 'android'))) {
    return true;
  }
  if (
    fs.existsSync(path.join(dir, 'expo-module.config.json')) ||
    fs.existsSync(path.join(dir, 'react-native.config.js'))
  ) {
    return true;
  }
  return fs.readdirSync(dir).some((f) => f.endsWith('.podspec'));
}

/**
 * Pure evaluation. `classify(name)` returns true / false / null (see above).
 * Returns { errors, warnings, ok }.
 */
function evaluate(baseline, pkg, classify) {
  const errors = [];
  const warnings = [];
  const base = baseline.dependencies || {};
  const allow = baseline.guardedAllowlist || {};
  const current = pkg.dependencies || {};

  for (const [name, version] of Object.entries(current)) {
    if (!(name in base)) {
      if (name in allow) {
        warnings.push(
          `${name}@${version} is newer than the store binary but guarded by ${allow[name]}`
        );
        continue;
      }
      const native = classify(name);
      if (native === false) {
        warnings.push(`${name}@${version} is new since the baseline (JS-only, OK for OTA)`);
      } else {
        errors.push(
          `${name}@${version} is new since the store binary baseline ` +
            `(${baseline.baselineCommit}) and ${
              native === null ? 'could not be classified (node_modules missing)' : 'has native code'
            }. Guard it with a lazy try/catch require and add it to ` +
            `guardedAllowlist in native-deps-baseline.json, or ship a new native build first.`
        );
      }
    } else if (base[name] !== version) {
      warnings.push(`${name} changed ${base[name]} -> ${version} since the baseline`);
    }
  }
  for (const name of Object.keys(allow)) {
    if (!(name in current)) {
      warnings.push(`guardedAllowlist entry ${name} is no longer in package.json (stale)`);
    }
  }
  return { errors, warnings, ok: errors.length === 0 };
}

function main(argv) {
  const warnOnly = argv.includes('--warn-only');
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));

  const upIdx = argv.indexOf('--update-baseline');
  if (upIdx !== -1) {
    const commit = argv[upIdx + 1];
    if (!commit || commit.startsWith('--')) {
      console.error('--update-baseline requires the commit the new native build was built from');
      return 2;
    }
    const build = argv[upIdx + 2] && !argv[upIdx + 2].startsWith('--') ? argv[upIdx + 2] : undefined;
    const next = {
      baselineCommit: commit,
      ...(build ? { baselineBuild: build } : {}),
      dependencies: pkg.dependencies || {},
      guardedAllowlist: {},
    };
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`native-deps-baseline.json updated from package.json at ${commit}`);
    return 0;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const { errors, warnings } = evaluate(baseline, pkg, (n) => isNativePackage(n));
  warnings.forEach((w) => console.warn(`::warning::native-deps: ${w}`));
  errors.forEach((e) => console.error(`::error::native-deps: ${e}`));
  if (errors.length === 0) {
    console.log(`native-deps: OK (baseline ${baseline.baselineCommit})`);
    return 0;
  }
  return warnOnly ? 0 : 1;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { evaluate, isNativePackage };
