export const SITE_EVENT_TYPES_V1 = [
  'inventory.cta.buy_now_click',
  'inventory.cta.order_now_click',
  'inventory.cta.browse_more_click',
  'inventory.cta.faq_toggle',
  'inventory.cta.rating_summary_click',
  'inventory.cta.contact_before_buy_click',
  'inventory.search.submit',
  'inventory.search.suggestion_select',
  'inventory.sort.select',
  'inventory.filter.change',
  'inventory.filter.clear',
  'inventory.location.select',
  'inventory.card.view_details_click',
  'inventory.card.image_lightbox_open',
  'inventory.checkout_dialog.open',
  'inventory.checkout_dialog.continue_click',
  'inventory.checkout_dialog.auth_redirect',
] as const;

export type SiteEventTypeV1 = (typeof SITE_EVENT_TYPES_V1)[number];

export const SITE_EVENT_SUBJECT_INVENTORY_ITEM = 'inventory_item';
