import fs from 'fs';
import path from 'path';

describe('Translation files - duplicate keys check', () => {
  // Resolve from project root since tests run from workspace root
  const localesDir = path.resolve(process.cwd(), 'apps/frontend/public/locales');

  function checkForDuplicateTopLevelKeys(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const duplicates: string[] = [];
    const seenKeys = new Set<string>();
    const lines = content.split('\n');
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('//')) continue;

      // Track depth by counting braces
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;

      // Only check keys at depth 0 (top-level)
      if (depth === 0) {
        const keyMatch = trimmed.match(/^"([^"]+)"\s*:/);
        if (keyMatch) {
          const key = keyMatch[1];
          if (seenKeys.has(key)) {
            duplicates.push(`Duplicate top-level key "${key}" at line ${i + 1}`);
          } else {
            seenKeys.add(key);
          }
        }
      }

      // Update depth
      depth += openBraces - closeBraces;
      depth = Math.max(0, depth);
    }

    return duplicates;
  }

  function checkForDuplicatesInSubtree(filePath: string, subtree: string): string[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const duplicates: string[] = [];
    const seenKeys = new Map<string, string>();
    const keyPath: string[] = [];
    const lines = content.split('\n');
    let depth = 0;
    let insideSubtree = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('//')) continue;

      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;

      const keyMatch = trimmed.match(/^"([^"]+)"\s*:/);
      if (keyMatch) {
        const key = keyMatch[1];

        // Adjust keyPath to current depth
        while (keyPath.length > depth) {
          keyPath.pop();
        }

        // Check if we're entering the target subtree
        if (depth === 0 && key === subtree) {
          insideSubtree = true;
        }

        // If we're inside the target subtree, check for duplicates
        if (insideSubtree && depth > 0) {
          const fullKey = keyPath.length > 0 ? `${keyPath.join('.')}.${key}` : key;
          const levelKey = `${depth}:${fullKey}`;

          if (seenKeys.has(levelKey)) {
            duplicates.push(`Duplicate key "${subtree}.${fullKey}" at line ${i + 1}`);
          } else {
            seenKeys.set(levelKey, fullKey);
          }
        }

        if (trimmed.endsWith('{')) {
          keyPath.push(key);
          depth++;
        }
      }

      // Update depth for closing braces
      if (closeBraces > 0) {
        for (let j = 0; j < closeBraces; j++) {
          if (keyPath.length > 0) {
            keyPath.pop();
          }
          depth = Math.max(0, depth - 1);

          // If we exit back to depth 0, we're out of the subtree
          if (depth === 0) {
            insideSubtree = false;
          }
        }
      }
    }

    return duplicates;
  }

  test('en.json has no duplicate top-level keys', () => {
    const enPath = path.join(localesDir, 'en.json');
    expect(fs.existsSync(enPath)).toBe(true);

    const duplicates = checkForDuplicateTopLevelKeys(enPath);

    if (duplicates.length > 0) {
      throw new Error(`Found duplicate top-level keys in en.json:\n${duplicates.join('\n')}`);
    }

    expect(duplicates).toEqual([]);
  });

  test('fr.json has no duplicate top-level keys', () => {
    const frPath = path.join(localesDir, 'fr.json');
    expect(fs.existsSync(frPath)).toBe(true);

    const duplicates = checkForDuplicateTopLevelKeys(frPath);

    if (duplicates.length > 0) {
      throw new Error(`Found duplicate top-level keys in fr.json:\n${duplicates.join('\n')}`);
    }

    expect(duplicates).toEqual([]);
  });

  test('en.json accounts subtree has no duplicate keys at any depth', () => {
    const enPath = path.join(localesDir, 'en.json');
    const duplicates = checkForDuplicatesInSubtree(enPath, 'accounts');

    if (duplicates.length > 0) {
      throw new Error(`Found duplicate keys in accounts subtree:\n${duplicates.join('\n')}`);
    }

    expect(duplicates).toEqual([]);
  });

  test('fr.json accounts subtree has no duplicate keys at any depth', () => {
    const frPath = path.join(localesDir, 'fr.json');
    const duplicates = checkForDuplicatesInSubtree(frPath, 'accounts');

    if (duplicates.length > 0) {
      throw new Error(`Found duplicate keys in accounts subtree:\n${duplicates.join('\n')}`);
    }

    expect(duplicates).toEqual([]);
  });

  test('en.json payment subtree has no duplicate keys at any depth', () => {
    const enPath = path.join(localesDir, 'en.json');
    const duplicates = checkForDuplicatesInSubtree(enPath, 'payment');

    if (duplicates.length > 0) {
      throw new Error(`Found duplicate keys in payment subtree:\n${duplicates.join('\n')}`);
    }

    expect(duplicates).toEqual([]);
  });

  test('fr.json payment subtree has no duplicate keys at any depth', () => {
    const frPath = path.join(localesDir, 'fr.json');
    const duplicates = checkForDuplicatesInSubtree(frPath, 'payment');

    if (duplicates.length > 0) {
      throw new Error(`Found duplicate keys in payment subtree:\n${duplicates.join('\n')}`);
    }

    expect(duplicates).toEqual([]);
  });

  test('JSON files are valid and parseable', () => {
    const enPath = path.join(localesDir, 'en.json');
    const frPath = path.join(localesDir, 'fr.json');

    expect(fs.existsSync(enPath)).toBe(true);
    expect(fs.existsSync(frPath)).toBe(true);

    const enContent = fs.readFileSync(enPath, 'utf8');
    const frContent = fs.readFileSync(frPath, 'utf8');

    expect(() => JSON.parse(enContent)).not.toThrow();
    expect(() => JSON.parse(frContent)).not.toThrow();
  });
});
