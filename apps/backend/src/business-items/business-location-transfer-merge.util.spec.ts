import { classifyMergeCandidates } from './business-location-transfer-merge.util';

describe('classifyMergeCandidates', () => {
  it('moves exclusive items without SKU collision', () => {
    const result = classifyMergeCandidates({
      items: [
        {
          id: 'i1',
          name: 'Widget',
          sku: 'W-1',
          sharedElsewhere: false,
        },
      ],
      rentals: [],
      destSkuSet: new Set(['other']),
      destRentalNameSet: new Set(),
    });
    expect(result.movableItemIds).toEqual(['i1']);
    expect(result.skippedDuplicates).toEqual([]);
    expect(result.skippedShared).toEqual([]);
  });

  it('skips SKU duplicates and leaves them out of movable', () => {
    const result = classifyMergeCandidates({
      items: [
        {
          id: 'i1',
          name: 'Widget',
          sku: 'W-1',
          sharedElsewhere: false,
        },
        {
          id: 'i2',
          name: 'Gadget',
          sku: null,
          sharedElsewhere: false,
        },
      ],
      rentals: [],
      destSkuSet: new Set(['w-1']),
      destRentalNameSet: new Set(),
    });
    expect(result.movableItemIds).toEqual(['i2']);
    expect(result.skippedDuplicates).toEqual([
      { itemId: 'i1', name: 'Widget', sku: 'W-1' },
    ]);
  });

  it('skips items shared across other locations', () => {
    const result = classifyMergeCandidates({
      items: [
        {
          id: 'i1',
          name: 'Shared',
          sku: 'S-1',
          sharedElsewhere: true,
        },
      ],
      rentals: [],
      destSkuSet: new Set(),
      destRentalNameSet: new Set(),
    });
    expect(result.movableItemIds).toEqual([]);
    expect(result.skippedShared).toEqual([
      { itemId: 'i1', name: 'Shared', sku: 'S-1' },
    ]);
  });

  it('skips rentals with matching destination names (case-insensitive)', () => {
    const result = classifyMergeCandidates({
      items: [],
      rentals: [
        {
          id: 'r1',
          name: 'Camera Kit',
          listingId: 'l1',
          sharedElsewhere: false,
        },
        {
          id: 'r2',
          name: 'Unique Drill',
          listingId: 'l2',
          sharedElsewhere: false,
        },
      ],
      destSkuSet: new Set(),
      destRentalNameSet: new Set(['camera kit']),
    });
    expect(result.movableRentalItemIds).toEqual(['r2']);
    expect(result.movableListingIds).toEqual(['l2']);
    expect(result.skippedDuplicates).toEqual([
      { itemId: 'r1', name: 'Camera Kit' },
    ]);
  });
});
