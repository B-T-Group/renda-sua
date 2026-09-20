import { allocatePurchaseCredits } from './purchase-credit.allocator';

describe('allocatePurchaseCredits', () => {
  const partner = new Set(['partner-1']);
  const lines = [
    { businessId: 'partner-1', subtotal: 4000 },
    { businessId: 'other', subtotal: 3000 },
  ];

  it('spends specific grants before partner and any-store grants', () => {
    const result = allocatePurchaseCredits({
      lines,
      partnerBusinessIds: partner,
      maxTotal: 10000,
      grants: [
        {
          id: 'any',
          remainingAmount: 10000,
          applicability: 'any_store',
          businessId: null,
          expiresAt: null,
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'named',
          remainingAmount: 1000,
          applicability: 'specific_business',
          businessId: 'partner-1',
          expiresAt: null,
          createdAt: '2026-01-02T00:00:00Z',
        },
        {
          id: 'partners',
          remainingAmount: 1500,
          applicability: 'partner_businesses',
          businessId: null,
          expiresAt: null,
          createdAt: '2026-01-03T00:00:00Z',
        },
      ],
    });

    expect(result.total).toBe(7000);
    expect(result.allocations).toEqual([
      { grantId: 'named', amount: 1000, applicability: 'specific_business', businessId: 'partner-1' },
      { grantId: 'partners', amount: 1500, applicability: 'partner_businesses', businessId: null },
      { grantId: 'any', amount: 4500, applicability: 'any_store', businessId: null },
    ]);
  });

  it('does not apply credits above the item cap', () => {
    const result = allocatePurchaseCredits({
      lines: [{ businessId: 'other', subtotal: 2000 }],
      partnerBusinessIds: partner,
      maxTotal: 500,
      grants: [
        {
          id: 'any',
          remainingAmount: 2000,
          applicability: 'any_store',
          businessId: null,
          expiresAt: null,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    });
    expect(result.total).toBe(500);
  });
});
