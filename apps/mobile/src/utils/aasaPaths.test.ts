import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PUBLIC = path.resolve(__dirname, '../../../frontend/public');
const FILES = [
  '.well-known/apple-app-site-association',
  '.well-known/apple-app-site-association.json',
  'apple-app-site-association',
];
const APP_ID = 'A289B23AXW.com.rendasua.agent';

type Details = {
  appID?: string;
  appIDs?: string[];
  paths?: string[];
  components?: { '/': string; exclude?: boolean }[];
};

function load(file: string): Details[] {
  return JSON.parse(readFileSync(path.join(PUBLIC, file), 'utf8')).applinks.details;
}

describe.each(FILES)('apple-app-site-association %s', (file) => {
  const details = load(file);
  const legacy = details.find((d) => d.paths);
  const modern = details.find((d) => d.components);

  it('claims the app id in both the legacy and component formats', () => {
    expect(legacy?.appID).toBe(APP_ID);
    expect(modern?.appIDs).toEqual([APP_ID]);
  });

  it('claims /app/*, /store/* and /items/* (which covers /items/:id/seo)', () => {
    expect(legacy?.paths).toEqual(
      expect.arrayContaining(['/app/*', '/store/*', '/items/*'])
    );
    const claimed = (modern?.components ?? []).filter((c) => !c.exclude).map((c) => c['/']);
    expect(claimed).toEqual(expect.arrayContaining(['/app/*', '/store/*', '/items/*']));
  });

  it('excludes place_order before the items claim (first match wins)', () => {
    const paths = legacy?.paths ?? [];
    expect(paths.indexOf('NOT /items/*/place_order*')).toBeGreaterThanOrEqual(0);
    expect(paths.indexOf('NOT /items/*/place_order*')).toBeLessThan(paths.indexOf('/items/*'));
    const comps = modern?.components ?? [];
    const exIdx = comps.findIndex((c) => c.exclude && c['/'] === '/items/*/place_order*');
    expect(exIdx).toBeGreaterThanOrEqual(0);
    expect(exIdx).toBeLessThan(comps.findIndex((c) => c['/'] === '/items/*'));
  });
});

describe('apple-app-site-association copies', () => {
  it('are identical', () => {
    const [first, ...rest] = FILES.map((f) => readFileSync(path.join(PUBLIC, f), 'utf8'));
    for (const other of rest) expect(other).toBe(first);
  });
});
