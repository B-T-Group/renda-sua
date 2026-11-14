import { describe, expect, it } from 'vitest';
import { presentSearchFirstEntry } from './presentSearchFirstEntry';

const next = { name: 'Canon', period: 'Thu 12 Nov · 1 day' };

describe('presentSearchFirstEntry', () => {
  it('keeps the header button when the client tab is off', () => {
    const entry = { onPress: () => undefined, next };
    expect(presentSearchFirstEntry(entry, false)).toBe(entry);
  });

  it('drops the header and keeps the next card when the client tab is on', () => {
    const entry = { onPress: () => undefined, next };
    expect(presentSearchFirstEntry(entry, true)).toEqual({ onPress: undefined, next });
  });

  it('hides the whole entry when the tab is on and there is no next card', () => {
    expect(presentSearchFirstEntry({ onPress: () => undefined, next: null }, true)).toBeUndefined();
  });
});
