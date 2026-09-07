import { resolveQuietHomeNextAction } from './resolveQuietHomeNextAction';
import type { DashboardAggregates } from '../types/business/dashboard';
import type { BusinessVerificationStatus } from '../services/businessVerificationApi';

const aggregates = (
  overrides: Partial<DashboardAggregates> = {}
): DashboardAggregates => ({
  ordersTotal: 0,
  ordersByStatus: {},
  pendingCashReconciliationCount: 0,
  itemCount: 5,
  rentalItemCount: 0,
  locationCount: 1,
  inventoryCount: 5,
  pendingFailedDeliveriesCount: 0,
  uniqueClientCount: 0,
  totalProductViews: 0,
  productViewsLast7d: 0,
  topViewedProducts: [],
  approvedItemCount: 5,
  approvedRentalCount: 0,
  hasLogo: true,
  hasOperatingHours: true,
  lastCatalogItemAt: null,
  itemsNeedingAiCleanupCount: 0,
  pendingItemCount: 0,
  rejectedItemCount: 0,
  topViewedOutOfStockCount: 0,
  tipsRemindersEnabled: true,
  ...overrides,
});

const verification = (
  overrides: Partial<BusinessVerificationStatus> = {}
): BusinessVerificationStatus => ({
  is_verified: true,
  can_accept_orders: true,
  accountFullName: 'Test Biz',
  nextAction: 'complete',
  paymentRail: 'mobile_money',
  steps: {
    agreement: { complete: true },
    identity: { complete: true, status: 'approved' },
    mobilePaymentPhone: { complete: true },
  },
  ...overrides,
});

const baseInput = (
  overrides: Partial<Parameters<typeof resolveQuietHomeNextAction>[0]> = {}
) => ({
  aggregates: aggregates(),
  verification: verification(),
  mainInterest: 'sell_items',
  aiTokens: 5,
  tipsRemindersEnabled: true,
  actionsNeededCount: 0,
  actionsNeededPendingFocus: false,
  showIdReview: false,
  showMmPhoneConfirm: false,
  isNudgeEligible: () => true,
  skipReachDuplicateTips: true,
  ...overrides,
});

describe('resolveQuietHomeNextAction', () => {
  it('returns cannot_accept_orders blocker first', () => {
    const action = resolveQuietHomeNextAction(
      baseInput({
        verification: verification({ can_accept_orders: false }),
        showIdReview: true,
        showMmPhoneConfirm: true,
        actionsNeededCount: 3,
      })
    );
    expect(action?.id).toBe('cannot_accept_orders');
    expect(action?.kind).toBe('blocker');
  });

  it('returns id_review before mm phone', () => {
    const action = resolveQuietHomeNextAction(
      baseInput({
        showIdReview: true,
        showMmPhoneConfirm: true,
      })
    );
    expect(action?.id).toBe('id_review');
  });

  it('returns confirm_mm_phone when no higher blocker', () => {
    expect(
      resolveQuietHomeNextAction(baseInput({ showMmPhoneConfirm: true }))?.id
    ).toBe('confirm_mm_phone');
  });

  it('returns actions_needed before growth tips', () => {
    const action = resolveQuietHomeNextAction(
      baseInput({
        actionsNeededCount: 2,
        aggregates: aggregates({ approvedItemCount: 3 }),
      })
    );
    expect(action).toMatchObject({
      id: 'actions_needed',
      kind: 'work',
      actionsCount: 2,
    });
  });

  it('skips catalog_goal when catalog health already has add_product CTA', () => {
    const action = resolveQuietHomeNextAction(
      baseInput({
        aggregates: aggregates({
          approvedItemCount: 3,
          hasLogo: false,
        }),
      })
    );
    // catalog_goal would normally win; skip → logo tip
    expect(action?.id).toBe('logo');
  });

  it('skips share_store tip (covered by reach card)', () => {
    const action = resolveQuietHomeNextAction(
      baseInput({
        aggregates: aggregates({
          approvedItemCount: 12,
          totalProductViews: 20,
          hasLogo: true,
          hasOperatingHours: true,
        }),
      })
    );
    expect(action?.id).not.toBe('share_store');
  });

  it('skips rejected_item tip when catalog health owns fix CTA', () => {
    const action = resolveQuietHomeNextAction(
      baseInput({
        aggregates: aggregates({
          approvedItemCount: 5,
          rejectedItemCount: 1,
          hasLogo: false,
        }),
      })
    );
    expect(action?.id).not.toBe('rejected_item');
    // Next tip after skip: catalog_goal (logo is lower priority).
    expect(action?.id).toBe('catalog_goal');
  });

  it('surfaces pending_moderation when eligible', () => {
    const action = resolveQuietHomeNextAction(
      baseInput({
        aggregates: aggregates({
          approvedItemCount: 12,
          pendingItemCount: 2,
          hasLogo: true,
          hasOperatingHours: true,
          totalProductViews: 0,
        }),
      })
    );
    expect(action?.id).toBe('pending_moderation');
    expect(action?.pendingCount).toBe(2);
  });

  it('returns null when nothing left after skips', () => {
    const action = resolveQuietHomeNextAction(
      baseInput({
        tipsRemindersEnabled: false,
        aggregates: aggregates({ approvedItemCount: 12 }),
      })
    );
    expect(action).toBeNull();
  });

  it('offers rentals when sale catalog exists and rentals are empty', () => {
    const action = resolveQuietHomeNextAction(
      baseInput({
        aggregates: aggregates({
          approvedItemCount: 12,
          rentalItemCount: 0,
          totalProductViews: 0,
        }),
        isNudgeEligible: (id) => id === 'merchant-tip:offer_rentals',
      })
    );
    expect(action?.id).toBe('offer_rentals');
  });

  it('offers sale items when rental catalog exists and items are empty', () => {
    const action = resolveQuietHomeNextAction(
      baseInput({
        mainInterest: 'rent_items',
        aggregates: aggregates({
          approvedRentalCount: 12,
          rentalItemCount: 12,
          itemCount: 0,
          totalProductViews: 0,
        }),
        isNudgeEligible: (id) => id === 'merchant-tip:offer_sale_items',
      })
    );
    expect(action?.id).toBe('offer_sale_items');
  });
});
