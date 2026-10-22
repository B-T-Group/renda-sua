import { describe, it, expect } from 'vitest';

type OfferDetails = {
  offerKind?: 'standard' | 'dedicated';
  pickup: {
    businessName?: string | null;
    locationName?: string | null;
  };
};

function shouldShowDedicatedBadge(details: OfferDetails | null | undefined): boolean {
  return details?.offerKind === 'dedicated';
}

function getDedicatedBadgeStore(details: OfferDetails): string {
  return details.pickup.locationName ?? details.pickup.businessName ?? 'A store';
}

describe('OrderOfferView dedicated badge', () => {
  describe('shouldShowDedicatedBadge', () => {
    it('should show badge when offerKind is dedicated', () => {
      const details: OfferDetails = {
        offerKind: 'dedicated',
        pickup: { businessName: 'Store Name' },
      };
      expect(shouldShowDedicatedBadge(details)).toBe(true);
    });

    it('should not show badge when offerKind is standard', () => {
      const details: OfferDetails = {
        offerKind: 'standard',
        pickup: { businessName: 'Store Name' },
      };
      expect(shouldShowDedicatedBadge(details)).toBe(false);
    });

    it('should not show badge when offerKind is missing', () => {
      const details: OfferDetails = {
        pickup: { businessName: 'Store Name' },
      };
      expect(shouldShowDedicatedBadge(details)).toBe(false);
    });

    it('should not show badge when details is null', () => {
      expect(shouldShowDedicatedBadge(null)).toBe(false);
    });

    it('should not show badge when details is undefined', () => {
      expect(shouldShowDedicatedBadge(undefined)).toBe(false);
    });
  });

  describe('getDedicatedBadgeStore', () => {
    it('should prefer locationName when available', () => {
      const details: OfferDetails = {
        offerKind: 'dedicated',
        pickup: {
          businessName: 'Business Name',
          locationName: 'Location Name',
        },
      };
      expect(getDedicatedBadgeStore(details)).toBe('Location Name');
    });

    it('should fall back to businessName when locationName is null', () => {
      const details: OfferDetails = {
        offerKind: 'dedicated',
        pickup: {
          businessName: 'Business Name',
          locationName: null,
        },
      };
      expect(getDedicatedBadgeStore(details)).toBe('Business Name');
    });

    it('should fall back to businessName when locationName is missing', () => {
      const details: OfferDetails = {
        offerKind: 'dedicated',
        pickup: {
          businessName: 'Business Name',
        },
      };
      expect(getDedicatedBadgeStore(details)).toBe('Business Name');
    });

    it('should use default when both are null', () => {
      const details: OfferDetails = {
        offerKind: 'dedicated',
        pickup: {
          businessName: null,
          locationName: null,
        },
      };
      expect(getDedicatedBadgeStore(details)).toBe('A store');
    });

    it('should use default when both are missing', () => {
      const details: OfferDetails = {
        offerKind: 'dedicated',
        pickup: {},
      };
      expect(getDedicatedBadgeStore(details)).toBe('A store');
    });

    it('should handle businessName with locationName undefined', () => {
      const details: OfferDetails = {
        offerKind: 'dedicated',
        pickup: {
          businessName: 'Business Name',
          locationName: undefined,
        },
      };
      expect(getDedicatedBadgeStore(details)).toBe('Business Name');
    });
  });
});
