import type { MetaStandardEventName } from './meta-conversions.constants';

export type MetaActionSource = 'website' | 'app' | 'other';

export type MetaUserDataInput = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  externalId?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

export type MetaContentItem = {
  id: string;
  quantity: number;
  item_price?: number;
};

export type MetaCustomDataInput = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  contents?: MetaContentItem[];
  content_type?: 'product' | 'product_group';
  content_name?: string;
  content_category?: string;
  order_id?: string;
  num_items?: number;
};

export type MetaSendStandardEventInput = {
  eventName: MetaStandardEventName;
  eventId: string;
  actionSource: MetaActionSource;
  userData: MetaUserDataInput;
  customData?: MetaCustomDataInput;
  eventSourceUrl?: string;
};

export type MetaProductTrackInput = {
  eventId: string;
  actionSource: MetaActionSource;
  inventoryItemId: string;
  quantity?: number;
  value?: number;
  currency?: string;
  contentName?: string;
  contentCategory?: string;
  externalId?: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  eventSourceUrl?: string;
};

export type MetaInitiateCheckoutInput = {
  eventId: string;
  actionSource: MetaActionSource;
  contentIds: string[];
  contents?: MetaContentItem[];
  value?: number;
  currency?: string;
  numItems?: number;
  externalId?: string;
  email?: string | null;
  phone?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  eventSourceUrl?: string;
};

export type OrderPaidEvent = {
  orderId: string;
};
