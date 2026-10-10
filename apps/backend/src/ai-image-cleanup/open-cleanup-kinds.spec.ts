import { groupOpenCleanupKinds } from './open-cleanup-kinds';

describe('groupOpenCleanupKinds', () => {
  it('groups ai and rembg by image and skips unknown kinds', () => {
    const map = groupOpenCleanupKinds([
      { image_id: 'img-1', kind: 'ai' },
      { image_id: 'img-1', kind: 'ai' },
      { image_id: 'img-1', kind: 'rembg' },
      { image_id: 'img-2', kind: 'rembg' },
      { image_id: null, kind: 'ai' },
      { image_id: 'img-2', kind: 'other' },
    ]);

    expect(map.get('img-1')).toEqual(['ai', 'rembg']);
    expect(map.get('img-2')).toEqual(['rembg']);
    expect(map.has('img-3')).toBe(false);
  });
});
