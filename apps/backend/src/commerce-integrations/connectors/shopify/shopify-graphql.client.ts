import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../../../config/configuration';

@Injectable()
export class ShopifyGraphqlClient {
  private readonly logger = new Logger(ShopifyGraphqlClient.name);

  constructor(private readonly configService: ConfigService<Configuration>) {}

  getApiVersion(): string {
    return (
      this.configService.get('commerceIntegrations')?.shopify?.apiVersion ||
      '2025-10'
    );
  }

  async request<T>(
    shopDomain: string,
    accessToken: string,
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const version = this.getApiVersion();
    const url = `https://${this.normalizeShop(shopDomain)}/admin/api/${version}/graphql.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After') || '2');
      throw Object.assign(new Error('Shopify rate limited'), {
        code: 'RATE_LIMITED',
        retryAfter,
      });
    }

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Shopify GraphQL HTTP ${response.status}: ${text}`);
      throw new Error(`Shopify GraphQL request failed: ${response.status}`);
    }

    const body = (await response.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };
    if (body.errors?.length) {
      throw new Error(body.errors.map((e) => e.message).join('; '));
    }
    if (!body.data) {
      throw new Error('Shopify GraphQL response missing data');
    }
    return body.data;
  }

  normalizeShop(shopDomain: string): string {
    return shopDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();
  }

  fromGid(gid: string): string {
    const parts = gid.split('/');
    return parts[parts.length - 1] || gid;
  }
}
