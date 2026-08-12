export type MerchantEngagementPushId =
  | 'push_catalog_stalled'
  | 'push_catalog_stalled_post10'
  | 'push_views_10'
  | 'push_catalog_10_congrats'
  | 'push_first_order_congrats'
  | 'push_ai_cleanup'
  | 'push_buy_tokens'
  | 'push_hours_logo'
  | 'push_rejected_item'
  | 'push_restock_top_viewed'
  | 'push_share_store'
  | 'push_payment_setup_nudge'
  | 'email_weekly_digest';

export type MerchantEngagementChannel = 'push' | 'email';

export interface MerchantEngagementCandidate {
  businessId: string;
  userId: string;
  email: string | null;
  preferredLanguage: string | null;
  businessName: string;
  mainInterest: 'sell_items' | 'rent_items' | string;
  aiTokens: number;
  tipsRemindersEnabled: boolean;
  canAcceptOrders: boolean;
  lifecycleStatus: string | null;
  hasExpoPush: boolean;
  approvedItemCount: number;
  approvedRentalCount: number;
  pendingItemCount: number;
  rejectedItemCount: number;
  hasLogo: boolean;
  hasOperatingHours: boolean;
  /** Present when payment rail is mobile money; omitted for Stripe. */
  mmPhoneComplete?: boolean;
  /**
   * True when shoppers are viewing a location that cannot take payment yet
   * (Stripe Connect incomplete, or MoMo phone unconfirmed on a viewed location).
   */
  needsPaymentSetupNudge?: boolean;
  /** Unique product views across locations that still need payment setup. */
  paymentSetupViewCount?: number;
  lastCatalogItemAt: string | null;
  itemsNeedingAiCleanupCount: number;
  topViewedOutOfStockCount: number;
  totalProductViews: number;
  ordersTotal: number;
  liveSince: string | null;
}

export interface EngagementMessage {
  title: string;
  body: string;
  data: Record<string, string>;
}
