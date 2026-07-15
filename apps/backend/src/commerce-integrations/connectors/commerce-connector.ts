export type CommerceProvider = 'shopify';

export type CommerceIntegrationStatus =
  | 'pending'
  | 'connected'
  | 'error'
  | 'disconnected'
  | 'reauth_required';

export type CommerceEntityType =
  | 'location'
  | 'product'
  | 'variant'
  | 'inventory_item'
  | 'inventory_level';

export type CommerceSyncTrigger =
  | 'INITIAL_IMPORT'
  | 'WEBHOOK'
  | 'RENDASUA_ORDER'
  | 'MANUAL_SYNC'
  | 'RECONCILIATION'
  | 'DISCONNECT';

export type CommerceSyncDirection = 'inbound' | 'outbound';

export type CommerceSyncStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'partial'
  | 'failed'
  | 'skipped';

export interface CommerceLocation {
  externalId: string;
  name: string;
  active: boolean;
  address?: string;
}

export interface CommerceProductVariant {
  externalId: string;
  externalInventoryItemId?: string;
  title: string;
  sku?: string;
  barcode?: string;
  price?: number;
  imageUrl?: string;
}

export interface CommerceProduct {
  externalId: string;
  title: string;
  description?: string;
  status?: string;
  imageUrls: string[];
  variants: CommerceProductVariant[];
  updatedAt?: string;
}

export interface CommerceInventoryLevel {
  externalInventoryItemId: string;
  externalLocationId: string;
  available: number;
  updatedAt?: string;
}

export interface CommerceInventoryAdjustment {
  externalInventoryItemId: string;
  externalLocationId: string;
  delta: number;
  idempotencyKey: string;
  reason?: string;
  referenceDocumentUri?: string;
}

export interface CommerceWebhookEvent {
  provider: CommerceProvider;
  eventId: string;
  topic: string;
  shopDomain?: string;
  payload: unknown;
}

export interface CommerceOAuthTokens {
  accessToken: string;
  scope?: string;
  shopDomain: string;
  shopId?: string;
  metadata?: Record<string, unknown>;
}

export interface CommerceConnector {
  readonly provider: CommerceProvider;

  getAuthorizationUrl(params: {
    state: string;
    shopDomain?: string;
  }): string;

  exchangeOAuthCode(params: {
    code: string;
    shopDomain: string;
  }): Promise<CommerceOAuthTokens>;

  disconnect(accessToken: string, shopDomain: string): Promise<void>;

  healthCheck(accessToken: string, shopDomain: string): Promise<boolean>;

  listLocations(
    accessToken: string,
    shopDomain: string
  ): Promise<CommerceLocation[]>;

  listProducts(
    accessToken: string,
    shopDomain: string,
    cursor?: string | null
  ): Promise<{ products: CommerceProduct[]; nextCursor: string | null }>;

  getInventoryLevels(
    accessToken: string,
    shopDomain: string,
    params: { locationIds?: string[]; cursor?: string | null }
  ): Promise<{
    levels: CommerceInventoryLevel[];
    nextCursor: string | null;
  }>;

  adjustInventory(
    accessToken: string,
    shopDomain: string,
    adjustment: CommerceInventoryAdjustment
  ): Promise<void>;

  registerWebhooks(
    accessToken: string,
    shopDomain: string,
    callbackUrl: string
  ): Promise<void>;

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): CommerceWebhookEvent | null;
}
