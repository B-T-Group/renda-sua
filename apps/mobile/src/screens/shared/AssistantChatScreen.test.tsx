import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('AssistantChatScreen restyle', () => {
  it('does not contain dark theme hardcoded colors', () => {
    const screenPath = join(
      __dirname,
      '../screens/shared/AssistantChatScreen.tsx'
    );
    const content = readFileSync(screenPath, 'utf-8');

    // AC1: Check that dark colors are removed
    expect(content).not.toMatch(/#050b16/i);
    expect(content).not.toMatch(/rgba\(255,255,255,0\.05\)/i);
    expect(content).not.toMatch(/rgba\(47,111,214,0\.18\)/i);
    expect(content).not.toMatch(/#00bcd4/i);
    expect(content).not.toMatch(/#006978/i);
    expect(content).not.toMatch(/#26c6da/i);
  });

  it('uses theme colors from useTheme', () => {
    const screenPath = join(
      __dirname,
      '../screens/shared/AssistantChatScreen.tsx'
    );
    const content = readFileSync(screenPath, 'utf-8');

    // Check that useTheme is imported and used
    expect(content).toMatch(/import.*useTheme.*from.*ThemeContext/);
    expect(content).toMatch(/const.*colors.*=.*useTheme\(\)/);
  });
});
