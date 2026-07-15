import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../../../config/configuration';
import {
  CommerceConnector,
  CommerceInventoryAdjustment,
  CommerceInventoryLevel,
  CommerceLocation,
  CommerceOAuthTokens,
  CommerceProduct,
  CommerceWebhookEvent,
} from '../commerce-connector';
import { ShopifyGraphqlClient } from './shopify-graphql.client';

const WEBHOOK_TOPICS = [
  'APP_UNINSTALLED',
  'PRODUCTS_UPDATE',
  'PRODUCTS_DELETE',
  'INVENTORY_LEVELS_UPDATE',
  'LOCATIONS_UPDATE',
  'LOCATIONS_DELETE',
] as const;

@Injectable()
export class ShopifyConnector implements CommerceConnector {
  readonly provider = 'shopify' as const;
  private readonly logger = new Logger(ShopifyConnector.name);

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly client: ShopifyGraphqlClient
  ) {}

  private shopifyConfig() {
    return this.configService.get('commerceIntegrations')?.shopify;
  }

  getAuthorizationUrl(params: {
    state: string;
    shopDomain?: string;
  }): string {
    const cfg = this.shopifyConfig();
    if (!cfg?.apiKey || !cfg?.scopes || !cfg?.appUrl) {
      throw new Error('Shopify OAuth is not configured');
    }
    const shop = this.client.normalizeShop(
      params.shopDomain || 'SHOP_PLACEHOLDER.myshopify.com'
    );
    const redirectUri = `${cfg.appUrl.replace(/\/$/, '')}/api/commerce-integrations/shopify/callback`;
    const scopes = cfg.scopes;
    return (
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${encodeURIComponent(cfg.apiKey)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(params.state)}`
    );
  }

  async exchangeOAuthCode(params: {
    code: string;
    shopDomain: string;
  }): Promise<CommerceOAuthTokens> {
    const cfg = this.shopifyConfig();
    if (!cfg?.apiKey || !cfg?.apiSecret) {
      throw new Error('Shopify OAuth is not configured');
    }
    const shop = this.client.normalizeShop(params.shopDomain);
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: cfg.apiKey,
        client_secret: cfg.apiSecret,
        code: params.code,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify token exchange failed: ${response.status} ${text}`);
    }
    const body = (await response.json()) as {
      access_token: string;
      scope?: string;
    };
    return {
      accessToken: body.access_token,
      scope: body.scope,
      shopDomain: shop,
      metadata: { apiVersion: this.client.getApiVersion() },
    };
  }

  async disconnect(accessToken: string, shopDomain: string): Promise<void> {
    try {
      await this.client.request(
        shopDomain,
        accessToken,
        `mutation { appUninstall { userErrors { message } } }`
      );
    } catch (error: any) {
      this.logger.warn(
        `Shopify disconnect/uninstall failed (continuing): ${error?.message}`
      );
    }
  }

  async healthCheck(accessToken: string, shopDomain: string): Promise<boolean> {
    try {
      await this.client.request<{ shop: { name: string } }>(
        shopDomain,
        accessToken,
        `query { shop { name } }`
      );
      return true;
    } catch {
      return false;
    }
  }

  async listLocations(
    accessToken: string,
    shopDomain: string
  ): Promise<CommerceLocation[]> {
    const data = await this.client.request<{
      locations: {
        edges: Array<{
          node: {
            id: string;
            name: string;
            isActive: boolean;
            address?: { formatted?: string[] };
          };
        }>;
      };
    }>(
      shopDomain,
      accessToken,
      `query {
        locations(first: 100) {
          edges {
            node {
              id
              name
              isActive
              address { formatted }
            }
          }
        }
      }`
    );
    return data.locations.edges.map((e) => ({
      externalId: e.node.id,
      name: e.node.name,
      active: e.node.isActive,
      address: e.node.address?.formatted?.join(', '),
    }));
  }

  async listProducts(
    accessToken: string,
    shopDomain: string,
    cursor?: string | null
  ): Promise<{ products: CommerceProduct[]; nextCursor: string | null }> {
    const data = await this.client.request<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: Array<{
          node: {
            id: string;
            title: string;
            descriptionHtml?: string;
            status: string;
            updatedAt: string;
            images: { edges: Array<{ node: { url: string } }> };
            variants: {
              edges: Array<{
                node: {
                  id: string;
                  title: string;
                  sku?: string;
                  barcode?: string;
                  price: string;
                  inventoryItem?: { id: string };
                  image?: { url: string };
                };
              }>;
            };
          };
        }>;
      };
    }>(
      shopDomain,
      accessToken,
      `query ListProducts($cursor: String) {
        products(first: 25, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              descriptionHtml
              status
              updatedAt
              images(first: 10) { edges { node { url } } }
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    barcode
                    price
                    inventoryItem { id }
                    image { url }
                  }
                }
              }
            }
          }
        }
      }`,
      { cursor: cursor || null }
    );

    const products: CommerceProduct[] = data.products.edges.map((e) => ({
      externalId: e.node.id,
      title: e.node.title,
      description: e.node.descriptionHtml,
      status: e.node.status,
      updatedAt: e.node.updatedAt,
      imageUrls: e.node.images.edges.map((i) => i.node.url),
      variants: e.node.variants.edges.map((v) => ({
        externalId: v.node.id,
        externalInventoryItemId: v.node.inventoryItem?.id,
        title: v.node.title,
        sku: v.node.sku || undefined,
        barcode: v.node.barcode || undefined,
        price: v.node.price ? Number(v.node.price) : undefined,
        imageUrl: v.node.image?.url,
      })),
    }));

    return {
      products,
      nextCursor: data.products.pageInfo.hasNextPage
        ? data.products.pageInfo.endCursor
        : null,
    };
  }

  async getInventoryLevels(
    accessToken: string,
    shopDomain: string,
    params: { locationIds?: string[]; cursor?: string | null }
  ): Promise<{
    levels: CommerceInventoryLevel[];
    nextCursor: string | null;
  }> {
    const locationIds = params.locationIds?.length
      ? params.locationIds
      : undefined;
    const data = await this.client.request<{
      inventoryItems: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: Array<{
          node: {
            id: string;
            inventoryLevels: {
              edges: Array<{
                node: {
                  updatedAt?: string;
                  location: { id: string };
                  quantities: Array<{ name: string; quantity: number }>;
                };
              }>;
            };
          };
        }>;
      };
    }>(
      shopDomain,
      accessToken,
      `query Inventory($cursor: String) {
        inventoryItems(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              inventoryLevels(first: 20) {
                edges {
                  node {
                    updatedAt
                    location { id }
                    quantities(names: ["available"]) { name quantity }
                  }
                }
              }
            }
          }
        }
      }`,
      { cursor: params.cursor || null }
    );

    const levels: CommerceInventoryLevel[] = [];
    for (const edge of data.inventoryItems.edges) {
      for (const level of edge.node.inventoryLevels.edges) {
        const locId = level.node.location.id;
        if (locationIds && !locationIds.includes(locId)) continue;
        const available =
          level.node.quantities.find((q) => q.name === 'available')?.quantity ??
          0;
        levels.push({
          externalInventoryItemId: edge.node.id,
          externalLocationId: locId,
          available,
          updatedAt: level.node.updatedAt,
        });
      }
    }

    return {
      levels,
      nextCursor: data.inventoryItems.pageInfo.hasNextPage
        ? data.inventoryItems.pageInfo.endCursor
        : null,
    };
  }

  async adjustInventory(
    accessToken: string,
    shopDomain: string,
    adjustment: CommerceInventoryAdjustment
  ): Promise<void> {
    const data = await this.client.request<{
      inventoryAdjustQuantities: {
        userErrors: Array<{ field?: string[]; message: string }>;
      };
    }>(
      shopDomain,
      accessToken,
      `mutation Adjust($input: InventoryAdjustQuantitiesInput!, $idempotencyKey: String!) {
        inventoryAdjustQuantities(input: $input) @idempotent(key: $idempotencyKey) {
          userErrors { field message }
        }
      }`,
      {
        idempotencyKey: adjustment.idempotencyKey,
        input: {
          reason: adjustment.reason || 'correction',
          name: 'available',
          referenceDocumentUri:
            adjustment.referenceDocumentUri ||
            `gid://rendasua/InventoryAdjustment/${adjustment.idempotencyKey}`,
          changes: [
            {
              delta: adjustment.delta,
              inventoryItemId: adjustment.externalInventoryItemId,
              locationId: adjustment.externalLocationId,
            },
          ],
        },
      }
    );
    const errors = data.inventoryAdjustQuantities.userErrors;
    if (errors?.length) {
      throw new Error(errors.map((e) => e.message).join('; '));
    }
  }

  async registerWebhooks(
    accessToken: string,
    shopDomain: string,
    callbackUrl: string
  ): Promise<void> {
    for (const topic of WEBHOOK_TOPICS) {
      try {
        await this.client.request(
          shopDomain,
          accessToken,
          `mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
            webhookSubscriptionCreate(
              topic: $topic
              webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }
            ) {
              userErrors { message }
            }
          }`,
          { topic, callbackUrl }
        );
      } catch (error: any) {
        this.logger.warn(
          `Webhook registration for ${topic} failed: ${error?.message}`
        );
      }
    }
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): CommerceWebhookEvent | null {
    const cfg = this.shopifyConfig();
    if (!cfg?.apiSecret) return null;

    const hmacHeader = this.headerValue(headers, 'x-shopify-hmac-sha256');
    const topic = this.headerValue(headers, 'x-shopify-topic');
    const shopDomain = this.headerValue(headers, 'x-shopify-shop-domain');
    const eventId =
      this.headerValue(headers, 'x-shopify-event-id') ||
      this.headerValue(headers, 'x-shopify-webhook-id');

    if (!hmacHeader || !topic || !eventId) return null;

    const digest = createHmac('sha256', cfg.apiSecret)
      .update(rawBody)
      .digest('base64');
    const a = Buffer.from(digest);
    const b = Buffer.from(hmacHeader);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }

    let payload: unknown = {};
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      payload = {};
    }

    return {
      provider: 'shopify',
      eventId,
      topic,
      shopDomain: shopDomain || undefined,
      payload,
    };
  }

  private headerValue(
    headers: Record<string, string | string[] | undefined>,
    name: string
  ): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    return value;
  }
}
