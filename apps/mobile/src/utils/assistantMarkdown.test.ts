import { describe, expect, it } from 'vitest';
import {
  parseAssistantMarkdown,
  stripAssistantMarkdown,
} from './assistantMarkdown';

describe('assistantMarkdown', () => {
  it('parses bold and bullets', () => {
    const blocks = parseAssistantMarkdown(
      'Offices:\n- **Montréal, QC (head office)** — Place Ville Marie\n- Sudbury, ON'
    );
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      inlines: [{ type: 'text', text: 'Offices:' }],
    });
    expect(blocks[1].type).toBe('bullet');
    if (blocks[1].type === 'bullet') {
      expect(blocks[1].inlines).toEqual([
        { type: 'bold', text: 'Montréal, QC (head office)' },
        { type: 'text', text: ' — Place Ville Marie' },
      ]);
    }
  });

  it('strips markers for plain fallback', () => {
    expect(stripAssistantMarkdown('- **Montréal**')).toBe('• Montréal');
  });
});
