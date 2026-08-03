import {
  computeListingQuality,
  nameSimilarity,
} from './listing-quality.util';

describe('listing-quality.util', () => {
  describe('computeListingQuality', () => {
    it('scores a complete listing highly', () => {
      const result = computeListingQuality({
        photoCount: 3,
        averageImageQuality: 90,
        name: 'Coca-Cola Zero 1.5L',
        description:
          'Refreshing sugar-free cola in a 1.5 litre bottle. Perfect for sharing.',
        categoryName: 'Beverages',
        brandName: 'Coca-Cola',
        hasWeightOrDimensions: true,
        hasBarcode: true,
      });
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.label).toBe('great');
      expect(result.suggestedAction).toBeNull();
    });

    it('suggests adding a second photo for single-photo listings', () => {
      const result = computeListingQuality({
        photoCount: 1,
        averageImageQuality: 80,
        name: 'Fresh tomatoes',
        description: 'Ripe tomatoes',
        categoryName: 'Produce',
      });
      expect(result.suggestedAction).toBe('add_second_photo');
    });
  });

  describe('nameSimilarity', () => {
    it('returns 1 for identical names', () => {
      expect(nameSimilarity('Coca-Cola Zero', 'coca-cola zero')).toBe(1);
    });

    it('detects high overlap for near-duplicates', () => {
      expect(
        nameSimilarity('Coca-Cola Zero 1.5L', 'Coca Cola Zero 1.5 L')
      ).toBeGreaterThanOrEqual(0.7);
    });
  });
});
