import { Injectable } from '@nestjs/common';
import {
  CommerceConnector,
  CommerceProvider,
} from './commerce-connector';
import { ShopifyConnector } from './shopify/shopify.connector';

@Injectable()
export class CommerceConnectorRegistry {
  private readonly connectors = new Map<CommerceProvider, CommerceConnector>();

  constructor(private readonly shopifyConnector: ShopifyConnector) {
    this.connectors.set('shopify', this.shopifyConnector);
  }

  get(provider: CommerceProvider): CommerceConnector {
    const connector = this.connectors.get(provider);
    if (!connector) {
      throw new Error(`No commerce connector registered for provider: ${provider}`);
    }
    return connector;
  }

  list(): CommerceProvider[] {
    return Array.from(this.connectors.keys());
  }
}
