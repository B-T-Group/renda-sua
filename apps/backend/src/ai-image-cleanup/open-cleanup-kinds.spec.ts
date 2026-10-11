import {
  groupOpenCleanupKinds,
  loadOpenCleanupKinds,
} from './open-cleanup-kinds';

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

describe('loadOpenCleanupKinds', () => {
  it('does not query when the photo list is empty', async () => {
    const executeQuery = jest.fn();
    const map = await loadOpenCleanupKinds({ executeQuery }, [], 'item');
    expect(map.size).toBe(0);
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('loads item photos and rental photos on their own image columns', async () => {
    const executeQuery = jest
      .fn()
      .mockResolvedValueOnce({ ai_image_cleanup_results: null })
      .mockResolvedValueOnce({
        ai_image_cleanup_results: [{ image_id: 'rent-1', kind: 'ai' }],
      });

    const items = await loadOpenCleanupKinds(
      { executeQuery },
      ['img-1'],
      'item'
    );
    const rentals = await loadOpenCleanupKinds(
      { executeQuery },
      ['rent-1'],
      'rental'
    );

    expect(items.size).toBe(0);
    expect(executeQuery.mock.calls[0][0]).toContain('business_image_id');
    expect(executeQuery.mock.calls[0][0]).not.toContain('rental_item_image_id');
    expect(executeQuery.mock.calls[0][1]).toEqual({ ids: ['img-1'] });
    expect(executeQuery.mock.calls[1][0]).toContain('rental_item_image_id');
    expect(rentals.get('rent-1')).toEqual(['ai']);
  });
});
