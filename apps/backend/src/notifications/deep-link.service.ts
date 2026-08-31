import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';

export interface DeepLinkPair {
  /** Custom scheme URL for installed apps, e.g. rendasua://orders/{id} */
  app: string;
  /** HTTPS universal link, e.g. https://rendasua.com/app/orders/{id} */
  universal: string;
  /** Relative web/PWA path used by existing push payloads */
  path: string;
}

@Injectable()
export class DeepLinkService {
  private readonly scheme = 'rendasua';

  constructor(private readonly configService: ConfigService<Configuration>) {}

  order(orderId: string): DeepLinkPair {
    return this.build(`orders/${orderId}`, `/orders/${orderId}`);
  }

  /** Superuser-only intervention view; not the persona-owned order screen. */
  adminOrder(orderId: string): DeepLinkPair {
    return this.build(`admin/orders/${orderId}`, `/admin/orders/${orderId}`);
  }

  delivery(offerOrDeliveryId: string): DeepLinkPair {
    return this.build(
      `deliveries/${offerOrDeliveryId}`,
      `/orders/${offerOrDeliveryId}`
    );
  }

  chat(threadOrOrderId: string): DeepLinkPair {
    return this.build(
      `chat/${threadOrOrderId}`,
      `/orders/${threadOrOrderId}/messages`
    );
  }

  wallet(): DeepLinkPair {
    return this.build('wallet', '/accounts');
  }

  rental(bookingOrRequestId: string): DeepLinkPair {
    return this.build(
      `rentals/${bookingOrRequestId}`,
      `/rentals/bookings/${bookingOrRequestId}`
    );
  }

  rentalRequest(requestId: string): DeepLinkPair {
    return this.build(
      `rentals/requests/${requestId}`,
      `/business/rentals/requests`
    );
  }

  productInterest(): DeepLinkPair {
    return this.build(
      'business/product-interest',
      '/business/product-interest'
    );
  }

  verification(): DeepLinkPair {
    return this.build('verification', '/documents');
  }

  /** Build links for an arbitrary app-relative path (no leading slash). */
  custom(appRelativePath: string, webPath: string): DeepLinkPair {
    return this.build(appRelativePath.replace(/^\//, ''), webPath);
  }

  private build(appRelative: string, webPath: string): DeepLinkPair {
    const path = webPath.startsWith('/') ? webPath : `/${webPath}`;
    const base = this.webOrigin();
    return {
      app: `${this.scheme}://${appRelative}`,
      universal: `${base}/app/${appRelative}`,
      path,
    };
  }

  private webOrigin(): string {
    const url = this.configService.get<string>('publicWebAppUrl');
    return (url || 'https://rendasua.com').replace(/\/$/, '');
  }
}
