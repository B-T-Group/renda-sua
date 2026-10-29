import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { evaluate } = require('../../scripts/check-native-deps.js');

const appRoot = path.resolve(__dirname, '../..');
const baseline = JSON.parse(
  fs.readFileSync(path.join(appRoot, 'native-deps-baseline.json'), 'utf8')
);
const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));

describe('check-native-deps evaluate()', () => {
  const base = { baselineCommit: 'abc', dependencies: { a: '1.0.0' }, guardedAllowlist: {} };

  it('passes when dependencies match the baseline', () => {
    const r = evaluate(base, { dependencies: { a: '1.0.0' } }, () => true);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('fails on a new native dependency without an allowlist entry', () => {
    const r = evaluate(base, { dependencies: { a: '1.0.0', b: '2.0.0' } }, () => true);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('b@2.0.0');
  });

  it('fails on a new dependency that cannot be classified', () => {
    const r = evaluate(base, { dependencies: { a: '1.0.0', b: '2.0.0' } }, () => null);
    expect(r.ok).toBe(false);
  });

  it('only warns on a new JS-only dependency', () => {
    const r = evaluate(base, { dependencies: { a: '1.0.0', b: '2.0.0' } }, () => false);
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBe(1);
  });

  it('passes a new native dependency that is in guardedAllowlist', () => {
    const withAllow = { ...base, guardedAllowlist: { b: 'src/utils/safeB.ts' } };
    const r = evaluate(withAllow, { dependencies: { a: '1.0.0', b: '2.0.0' } }, () => true);
    expect(r.ok).toBe(true);
  });

  it('warns on version drift of a baseline dependency', () => {
    const r = evaluate(base, { dependencies: { a: '1.1.0' } }, () => true);
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toContain('1.0.0 -> 1.1.0');
  });

  it('warns when a guardedAllowlist entry is no longer a dependency', () => {
    const withAllow = { ...base, guardedAllowlist: { gone: 'src/utils/safeGone.ts' } };
    const r = evaluate(withAllow, { dependencies: { a: '1.0.0' } }, () => true);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w: string) => w.includes('gone') && w.includes('stale'))).toBe(true);
  });

  it('does not fail the OTA check when a baseline dependency was removed', () => {
    const r = evaluate(base, { dependencies: {} }, () => true);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
});

describe('repo native dependency baseline', () => {
  it('current package.json has no unguarded new native dependencies', () => {
    const r = evaluate(baseline, pkg, () => true);
    expect(r.errors).toEqual([]);
  });

  it('every guardedAllowlist entry points at an existing guard file', () => {
    for (const file of Object.values<string>(baseline.guardedAllowlist)) {
      expect(fs.existsSync(path.join(appRoot, file))).toBe(true);
    }
  });

  it('guarded packages are never referenced outside their guard file', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules') walk(full);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const rel = path.relative(appRoot, full);
          if (/\.test\.|[\\/]__tests__[\\/]/.test(rel)) continue;
          const src = fs.readFileSync(full, 'utf8');
          for (const [dep, guardFile] of Object.entries<string>(baseline.guardedAllowlist)) {
            if (rel !== guardFile && (src.includes(`'${dep}'`) || src.includes(`"${dep}"`))) offenders.push(`${rel} -> ${dep}`);
          }
        }
      }
    };
    walk(path.join(appRoot, 'src'));
    for (const f of ['App.tsx', 'index.js']) {
      const src = fs.readFileSync(path.join(appRoot, f), 'utf8');
      for (const dep of Object.keys(baseline.guardedAllowlist)) {
        if (src.includes(`'${dep}'`) || src.includes(`"${dep}"`)) offenders.push(`${f} -> ${dep}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
