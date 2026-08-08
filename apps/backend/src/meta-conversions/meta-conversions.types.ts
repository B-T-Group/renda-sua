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
  /** Meta click id cookie (`_fbc`); do not hash. */
  fbc?: string | null;
  /** Meta browser id cookie (`_fbp`); do not hash. */
  fbp?: string | null;
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
  /** CompleteRegistration: registration succeeded. */
  status?: boolean | string;
  /** CompleteRegistration: client | delivery_agent | business. */
  user_type?: string;
};

export type MetaCompleteRegistrationInput = {
  eventId: string;
  actionSource: MetaActionSource;
  userType: string;
  externalId?: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  eventSourceUrl?: string;
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
  fbc?: string | null;
  fbp?: string | null;
  eventSourceUrl?: string;
  /**
   * When true, load hashed email/phone/name from Hasura for externalId.
   * Must only be set when externalId came from a verified Bearer JWT.
   */
  allowUserEnrichment?: boolean;
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
  firstName?: string | null;
  lastName?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  eventSourceUrl?: string;
  /** See MetaProductTrackInput.allowUserEnrichment. */
  allowUserEnrichment?: boolean;
};

export type OrderPaidEvent = {
  orderId: string;
};
