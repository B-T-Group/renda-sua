import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Configuration } from '../config/configuration';
import { BusinessItemsAccessService } from '../business-items/business-items-access.service';
import { CommerceTokenCryptoService } from './commerce-token-crypto.service';
import {
  CommerceIntegrationRow,
  CommerceIntegrationsDatabaseService,
} from './commerce-integrations-database.service';
import { CommerceConnectorRegistry } from './connectors/connector.registry';
import { CommerceProvider } from './connectors/commerce-connector';

@Injectable()
export class CommerceConnectionService {
  private readonly logger = new Logger(CommerceConnectionService.name);

  constructor(
    private readonly db: CommerceIntegrationsDatabaseService,
    private readonly registry: CommerceConnectorRegistry,
    private readonly tokenCrypto: CommerceTokenCryptoService,
    private readonly access: BusinessItemsAccessService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  async listForCurrentBusiness(requestedBusinessId?: string) {
    const ctx = await this.access.resolveAccess(requestedBusinessId);
    const rows = await this.db.listIntegrationsForBusiness(ctx.targetBusinessId);
    return rows.map((r) => this.toPublic(r));
  }

  async startShopifyInstall(params: {
    businessId?: string;
    shopDomain: string;
  }): Promise<{ authorizationUrl: string }> {
    const ctx = await this.access.resolveAccess(params.businessId);
    const shop = params.shopDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();
    if (!shop.endsWith('.myshopify.com')) {
      throw new HttpException(
        { success: false, error: 'Shop domain must be *.myshopify.com' },
        HttpStatus.BAD_REQUEST
      );
    }

    const existingShop = await this.db.findIntegrationByShop('shopify', shop);
    if (
      existingShop &&
      existingShop.business_id !== ctx.targetBusinessId &&
      existingShop.status !== 'disconnected'
    ) {
      throw new HttpException(
        {
          success: false,
          error: 'This Shopify store is already connected to another business',
        },
        HttpStatus.CONFLICT
      );
    }

    const state = this.signState({
      businessId: ctx.targetBusinessId,
      shopDomain: shop,
      nonce: randomBytes(8).toString('hex'),
      exp: Date.now() + 10 * 60 * 1000,
    });

    const connector = this.registry.get('shopify');
    const authorizationUrl = connector.getAuthorizationUrl({
      state,
      shopDomain: shop,
    });
    return { authorizationUrl };
  }

  async handleShopifyCallback(params: {
    code?: string;
    shop?: string;
    state?: string;
  }): Promise<{ redirectUrl: string }> {
    const frontendUrl =
      this.configService.get('publicWebAppUrl') ||
      process.env.FRONTEND_URL ||
      'http://localhost:4200';

    try {
      if (!params.code || !params.shop || !params.state) {
        throw new Error('Missing OAuth parameters');
      }
      const state = this.verifyState(params.state);
      const shop = params.shop
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .toLowerCase();
      if (state.shopDomain !== shop) {
        throw new Error('Shop domain mismatch in OAuth state');
      }

      const existingShop = await this.db.findIntegrationByShop('shopify', shop);
      if (
        existingShop &&
        existingShop.business_id !== state.businessId &&
        existingShop.status !== 'disconnected'
      ) {
        throw new Error(
          'This Shopify store is already connected to another business'
        );
      }

      const connector = this.registry.get('shopify');
      const tokens = await connector.exchangeOAuthCode({
        code: params.code,
        shopDomain: shop,
      });
      const encrypted = this.tokenCrypto.encrypt(tokens.accessToken);

      const integration = await this.db.upsertIntegration({
        business_id: state.businessId,
        provider: 'shopify',
        external_shop_id: shop,
        display_name: shop,
        status: 'connected',
        access_token_encrypted: encrypted,
        scopes: tokens.scope,
        provider_metadata: tokens.metadata ?? {},
      });
      await this.db.updateIntegration(integration.id, {
        feature_flags: {
          inboundInventorySyncEnabled: true,
          outboundInventorySyncEnabled: false,
        },
      });

      const cfg = this.configService.get('commerceIntegrations');
      const callbackUrl = `${(cfg?.shopify?.appUrl || '').replace(/\/$/, '')}/api/commerce-integrations/webhooks/shopify`;
      if (callbackUrl.startsWith('http')) {
        await connector.registerWebhooks(
          tokens.accessToken,
          shop,
          callbackUrl
        );
      }

      this.logger.log(
        `Shopify connected for business ${state.businessId} shop ${shop} integration ${integration.id}`
      );

      return {
        redirectUrl: `${frontendUrl}/business/integrations?connected=shopify&integrationId=${integration.id}`,
      };
    } catch (error: any) {
      this.logger.error(`Shopify OAuth callback failed: ${error?.message}`);
      return {
        redirectUrl: `${frontendUrl}/business/integrations?error=${encodeURIComponent(
          error?.message || 'oauth_failed'
        )}`,
      };
    }
  }

  async disconnect(integrationId: string, businessId?: string) {
    const ctx = await this.access.resolveAccess(businessId);
    const integration = await this.requireOwnedIntegration(
      integrationId,
      ctx.targetBusinessId
    );
    const token = this.decryptToken(integration);
    if (token) {
      try {
        await this.registry
          .get(integration.provider)
          .disconnect(token, integration.external_shop_id);
      } catch (error: any) {
        this.logger.warn(`Provider disconnect failed: ${error?.message}`);
      }
    }
    await this.db.updateIntegration(integration.id, {
      status: 'disconnected',
      access_token_encrypted: null,
      last_error: null,
    });
    await this.db.recordSyncEvent({
      integration_id: integration.id,
      provider: integration.provider,
      direction: 'inbound',
      trigger: 'DISCONNECT',
      status: 'success',
    });
    return { success: true };
  }

  async requireOwnedIntegration(
    integrationId: string,
    businessId: string
  ): Promise<CommerceIntegrationRow> {
    const integration = await this.db.findIntegrationById(integrationId);
    if (!integration || integration.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Integration not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return integration;
  }

  decryptToken(integration: CommerceIntegrationRow): string | null {
    if (!integration.access_token_encrypted) return null;
    return this.tokenCrypto.decrypt(integration.access_token_encrypted);
  }

  toPublic(row: CommerceIntegrationRow) {
    return {
      id: row.id,
      businessId: row.business_id,
      provider: row.provider,
      shopDomain: row.external_shop_id,
      displayName: row.display_name,
      status: row.status,
      scopes: row.scopes,
      featureFlags: row.feature_flags ?? {},
      lastSyncedAt: row.last_synced_at,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  getDecryptedAccess(provider: CommerceProvider, integration: CommerceIntegrationRow) {
    const token = this.decryptToken(integration);
    if (!token) {
      throw new HttpException(
        { success: false, error: 'Integration token missing; reconnect required' },
        HttpStatus.BAD_REQUEST
      );
    }
    return { token, connector: this.registry.get(provider) };
  }

  private signState(payload: Record<string, unknown>): string {
    const secret = this.stateSecret();
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state: string): {
    businessId: string;
    shopDomain: string;
    nonce: string;
    exp: number;
  } {
    const [body, sig] = state.split('.');
    if (!body || !sig) throw new Error('Invalid OAuth state');
    const expected = createHmac('sha256', this.stateSecret())
      .update(body)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Invalid OAuth state signature');
    }
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as {
      businessId: string;
      shopDomain: string;
      nonce: string;
      exp: number;
    };
    if (!payload.exp || Date.now() > payload.exp) {
      throw new Error('OAuth state expired');
    }
    return payload;
  }

  private stateSecret(): string {
    const secret =
      this.configService.get('commerceIntegrations')?.oauthStateSecret ||
      this.configService.get('commerceIntegrations')?.shopify?.apiSecret ||
      process.env.COMMERCE_OAUTH_STATE_SECRET;
    if (!secret) {
      throw new Error(
        'COMMERCE_OAUTH_STATE_SECRET or SHOPIFY_API_SECRET is required'
      );
    }
    return secret;
  }
}
