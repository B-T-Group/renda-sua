export const SITE_EVENT_TYPES_V1 = [
  'inventory.cta.buy_now_click',
  'inventory.cta.order_now_click',
] as const;

export type SiteEventTypeV1 = (typeof SITE_EVENT_TYPES_V1)[number];

export const SITE_EVENT_SUBJECT_INVENTORY_ITEM = 'inventory_item';
