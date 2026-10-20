import fs from 'fs';
import path from 'path';

describe('Translation files - duplicate keys check', () => {
  // Resolve from project root since tests run from workspace root
  const localesDir = path.resolve(process.cwd(), 'apps/frontend/public/locales');

  function checkForDuplicateTopLevelKeys(content: string): string[] {
    const duplicates: string[] = [];
    const seenKeys = new Set<string>();
    const lines = content.split('\n');
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('//')) continue;

      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;

      // Check for key BEFORE updating depth
      // Top-level keys appear when depth is currently 0 and will become 1 after this line,
      // OR when depth is already 1 and stays 1
      const keyMatch = trimmed.match(/^"([^"]+)"\s*:/);
      if (keyMatch) {
        const key = keyMatch[1];
        // A key is top-level if:
        // - We're at depth 0 and the line has an opening brace (entering root object)
        // - We're at depth 1 and the line will keep us at depth 1 or deeper
        const willBeTopLevel = 
          (depth === 0 && openBraces > closeBraces) ||
          (depth === 1);

        if (willBeTopLevel) {
          if (seenKeys.has(key)) {
            duplicates.push(`Duplicate top-level key "${key}" at line ${i + 1}`);
          } else {
            seenKeys.add(key);
          }
        }
      }

      // Update depth AFTER checking the key
      depth += openBraces - closeBraces;
      depth = Math.max(0, depth);
    }

    return duplicates;
  }

  function checkForDuplicatesInSubtree(content: string, subtree: string): string[] {
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
        const willBeTopLevel = (depth === 0 && openBraces > closeBraces) || (depth === 1);
        if (willBeTopLevel && key === subtree) {
          insideSubtree = true;
        }

        // If we're inside the target subtree, check for duplicates
        if (insideSubtree && depth >= 1) {
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
        }
      }

      // Update depth for braces
      depth += openBraces - closeBraces;
      depth = Math.max(0, depth);

      // Adjust keyPath after depth update
      while (keyPath.length > depth) {
        keyPath.pop();
      }

      // If we exit back to depth 0 or 1, we might be out of the subtree
      if (depth <= 1 && insideSubtree) {
        // Check if we're still in the subtree or have exited
        if (keyPath.length === 0 || keyPath[0] !== subtree) {
          insideSubtree = false;
        }
      }
    }

    return duplicates;
  }

  test('Scanner detects duplicate top-level keys (fixture test)', () => {
    const brokenJson = `{
  "accounts": {
    "key1": "value1"
  },
  "payment": {
    "key2": "value2"
  },
  "accounts": {
    "key3": "value3"
  }
}`;

    const duplicates = checkForDuplicateTopLevelKeys(brokenJson);
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates[0]).toContain('Duplicate top-level key "accounts"');
  });

  test('Scanner passes on clean top-level keys (fixture test)', () => {
    const cleanJson = `{
  "accounts": {
    "key1": "value1"
  },
  "payment": {
    "key2": "value2"
  },
  "client": {
    "key3": "value3"
  }
}`;

    const duplicates = checkForDuplicateTopLevelKeys(cleanJson);
    expect(duplicates).toEqual([]);
  });

  test('en.json has no duplicate accounts or payment top-level keys', () => {
    const enPath = path.join(localesDir, 'en.json');
    expect(fs.existsSync(enPath)).toBe(true);

    const content = fs.readFileSync(enPath, 'utf8');
    const duplicates = checkForDuplicateTopLevelKeys(content);

    // Only fail on duplicate 'accounts' or 'payment' (keys touched by this PR)
    const criticalDuplicates = duplicates.filter(d => 
      d.includes('"accounts"') || d.includes('"payment"')
    );

    if (criticalDuplicates.length > 0) {
      throw new Error(`Found duplicate accounts/payment keys in en.json:\n${criticalDuplicates.join('\n')}`);
    }

    expect(criticalDuplicates).toEqual([]);
  });

  test('fr.json has no duplicate accounts or payment top-level keys', () => {
    const frPath = path.join(localesDir, 'fr.json');
    expect(fs.existsSync(frPath)).toBe(true);

    const content = fs.readFileSync(frPath, 'utf8');
    const duplicates = checkForDuplicateTopLevelKeys(content);

    // Only fail on duplicate 'accounts' or 'payment' (keys touched by this PR)
    const criticalDuplicates = duplicates.filter(d =>
      d.includes('"accounts"') || d.includes('"payment"')
    );

    if (criticalDuplicates.length > 0) {
      throw new Error(`Found duplicate accounts/payment keys in fr.json:\n${criticalDuplicates.join('\n')}`);
    }

    expect(criticalDuplicates).toEqual([]);
  });

  test('en.json accounts subtree has no duplicate keys at any depth', () => {
    const enPath = path.join(localesDir, 'en.json');
    const content = fs.readFileSync(enPath, 'utf8');
    const duplicates = checkForDuplicatesInSubtree(content, 'accounts');

    if (duplicates.length > 0) {
      throw new Error(`Found duplicate keys in accounts subtree:\n${duplicates.join('\n')}`);
    }

    expect(duplicates).toEqual([]);
  });

  test('fr.json accounts subtree has no duplicate keys at any depth', () => {
    const frPath = path.join(localesDir, 'fr.json');
    const content = fs.readFileSync(frPath, 'utf8');
    const duplicates = checkForDuplicatesInSubtree(content, 'accounts');

    if (duplicates.length > 0) {
      throw new Error(`Found duplicate keys in accounts subtree:\n${duplicates.join('\n')}`);
    }

    expect(duplicates).toEqual([]);
  });

  test('en.json payment subtree has no duplicate keys at any depth', () => {
    const enPath = path.join(localesDir, 'en.json');
    const content = fs.readFileSync(enPath, 'utf8');
    const duplicates = checkForDuplicatesInSubtree(content, 'payment');

    if (duplicates.length > 0) {
      throw new Error(`Found duplicate keys in payment subtree:\n${duplicates.join('\n')}`);
    }

    expect(duplicates).toEqual([]);
  });

  test('fr.json payment subtree has no duplicate keys at any depth', () => {
    const frPath = path.join(localesDir, 'fr.json');
    const content = fs.readFileSync(frPath, 'utf8');
    const duplicates = checkForDuplicatesInSubtree(content, 'payment');

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
