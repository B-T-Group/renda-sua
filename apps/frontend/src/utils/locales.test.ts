import fs from 'fs';
import path from 'path';

describe('Translation files - duplicate keys check', () => {
  // Resolve from project root since tests run from workspace root
  const localesDir = path.resolve(process.cwd(), 'apps/frontend/public/locales');

  function checkForDuplicateKeys(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const duplicates: string[] = [];
    const keyPath: string[] = [];
    const seenKeys = new Map<string, string>();

    // Track depth and keys manually
    let depth = 0;
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//')) continue;

      // Track object depth
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;

      // Extract key from lines like "key": value or "key": {
      const keyMatch = trimmed.match(/^"([^"]+)"\s*:/);
      if (keyMatch) {
        const key = keyMatch[1];

        // Adjust key path to current depth
        while (keyPath.length > depth) {
          keyPath.pop();
        }

        const fullKey = keyPath.length > 0 ? `${keyPath.join('.')}.${key}` : key;

        // Check if this key already exists at this level
        const levelKey = `${depth}:${fullKey}`;
        if (seenKeys.has(levelKey)) {
          duplicates.push(`Duplicate key "${fullKey}" at line ${i + 1}`);
        } else {
          seenKeys.set(levelKey, fullKey);
        }

        // If this is an object, push key to path
        if (trimmed.endsWith('{')) {
          keyPath.push(key);
          depth++;
        }
      }

      // Adjust depth for closing braces
      if (closeBraces > 0) {
        for (let j = 0; j < closeBraces; j++) {
          if (keyPath.length > 0) {
            keyPath.pop();
          }
          depth = Math.max(0, depth - 1);
        }
      }
    }

    return duplicates;
  }

  test('en.json has no duplicate keys at any level', () => {
    const enPath = path.join(localesDir, 'en.json');
    expect(fs.existsSync(enPath)).toBe(true);

    const duplicates = checkForDuplicateKeys(enPath);

    if (duplicates.length > 0) {
      throw new Error(`Found duplicate keys in en.json:\n${duplicates.join('\n')}`);
    }

    expect(duplicates).toEqual([]);
  });

  test('fr.json has no duplicate keys at any level', () => {
    const frPath = path.join(localesDir, 'fr.json');
    expect(fs.existsSync(frPath)).toBe(true);

    const duplicates = checkForDuplicateKeys(frPath);

    if (duplicates.length > 0) {
      throw new Error(`Found duplicate keys in fr.json:\n${duplicates.join('\n')}`);
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
