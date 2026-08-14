import {
  countAiSelections,
  normalizeCleanupSelections,
} from './cleanup-selection.util';

describe('cleanup selection util', () => {
  it('defaults bare imageIds to ai', () => {
    expect(
      normalizeCleanupSelections({
        imageIds: ['a', 'b'],
      })
    ).toEqual([
      { imageId: 'a', kind: 'ai' },
      { imageId: 'b', kind: 'ai' },
    ]);
  });

  it('prefers explicit selections', () => {
    expect(
      normalizeCleanupSelections({
        imageIds: ['a'],
        selections: [
          { imageId: 'a', kind: 'rembg' },
          { imageId: 'b', kind: 'ai' },
        ],
      })
    ).toEqual([
      { imageId: 'a', kind: 'rembg' },
      { imageId: 'b', kind: 'ai' },
    ]);
  });

  it('returns null when neither provided (caller loads all as ai)', () => {
    expect(normalizeCleanupSelections({})).toBeNull();
  });

  it('dedupes duplicate imageId+kind pairs', () => {
    expect(
      normalizeCleanupSelections({
        selections: [
          { imageId: 'a', kind: 'ai' },
          { imageId: 'a', kind: 'ai' },
          { imageId: 'a', kind: 'rembg' },
        ],
      })
    ).toEqual([
      { imageId: 'a', kind: 'ai' },
      { imageId: 'a', kind: 'rembg' },
    ]);
  });

  it('counts only ai for token reserve', () => {
    expect(
      countAiSelections([
        { kind: 'rembg' },
        { kind: 'ai' },
        { kind: 'ai' },
        { kind: 'rembg' },
      ])
    ).toBe(2);
  });
});
