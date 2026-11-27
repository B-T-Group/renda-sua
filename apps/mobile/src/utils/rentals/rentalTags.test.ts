import { describe, expect, it } from 'vitest';
import { addTags, parseTagInput, removeTag } from './rentalTags';

describe('rentalTags', () => {
  it('parses comma and newline separated input', () => {
    expect(parseTagInput(' jbl, partybox\nspeaker ,, ')).toEqual([
      'jbl',
      'partybox',
      'speaker',
    ]);
  });

  it('adds new tags and skips case-insensitive duplicates', () => {
    expect(addTags(['JBL'], 'jbl, Speaker, speaker')).toEqual(['JBL', 'Speaker']);
  });

  it('removes a tag', () => {
    expect(removeTag(['a', 'b'], 'a')).toEqual(['b']);
  });
});
