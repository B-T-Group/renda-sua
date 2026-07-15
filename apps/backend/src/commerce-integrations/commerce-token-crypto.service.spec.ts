import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { CommerceTokenCryptoService } from './commerce-token-crypto.service';
import { ShopifyConnector } from './connectors/shopify/shopify.connector';
import { ShopifyGraphqlClient } from './connectors/shopify/shopify-graphql.client';

describe('CommerceTokenCryptoService', () => {
  it('encrypts and decrypts round-trip', () => {
    process.env.COMMERCE_TOKEN_ENCRYPTION_KEY = 'test-commerce-key';
    const svc = new CommerceTokenCryptoService({
      get: () => ({ tokenEncryptionKey: 'test-commerce-key' }),
    } as unknown as ConfigService);
    const cipher = svc.encrypt('shpat_example_token');
    expect(cipher).not.toContain('shpat_example_token');
    expect(svc.decrypt(cipher)).toBe('shpat_example_token');
  });
});

describe('ShopifyConnector.verifyWebhook', () => {
  it('accepts valid HMAC and rejects invalid', () => {
    const secret = 'shopify-secret';
    const connector = new ShopifyConnector(
      {
        get: () => ({
          shopify: {
            apiKey: 'key',
            apiSecret: secret,
            scopes: 'read_products',
            apiVersion: '2025-10',
            appUrl: 'https://api.example.com',
          },
        }),
      } as unknown as ConfigService,
      {
        getApiVersion: () => '2025-10',
        normalizeShop: (s: string) => s,
      } as unknown as ShopifyGraphqlClient
    );

    const rawBody = Buffer.from(JSON.stringify({ available: 3 }));
    const hmac = createHmac('sha256', secret).update(rawBody).digest('base64');
    const valid = connector.verifyWebhook(rawBody, {
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-topic': 'inventory_levels/update',
      'x-shopify-shop-domain': 'demo.myshopify.com',
      'x-shopify-event-id': 'evt-1',
    });
    expect(valid?.eventId).toBe('evt-1');
    expect(valid?.provider).toBe('shopify');

    const invalid = connector.verifyWebhook(rawBody, {
      'x-shopify-hmac-sha256': 'bad',
      'x-shopify-topic': 'inventory_levels/update',
      'x-shopify-shop-domain': 'demo.myshopify.com',
      'x-shopify-event-id': 'evt-2',
    });
    expect(invalid).toBeNull();
  });
});
