import { Injectable } from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { CatalogExperienceContext } from './catalog-experience.types';

export interface CatalogExperienceQuery {
  country_code?: string;
  state?: string;
  language?: string;
  layout?: string;
  device?: string;
}

interface ViewerGeo {
  userId?: string;
  clientId?: string;
  country?: string;
  state?: string;
}

@Injectable()
export class CatalogExperienceContextBuilder {
  constructor(
    private readonly hasuraUser: HasuraUserService,
    private readonly hasura: HasuraSystemService
  ) {}

  async build(query: CatalogExperienceQuery): Promise<CatalogExperienceContext> {
    const viewer = await this.loadViewer();
    const layout = query.layout === 'results' ? 'results' : 'discovery';
    const country = query.country_code?.trim() || viewer.country;
    return {
      userId: viewer.userId,
      clientId: viewer.clientId,
      country,
      state: this.resolveState(query, viewer),
      language: query.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en',
      layout,
      device: query.device?.trim() || undefined,
      isReturning: await this.resolveReturning(layout, viewer),
    };
  }

  private resolveState(
    query: CatalogExperienceQuery,
    viewer: ViewerGeo
  ): string | undefined {
    if (query.country_code?.trim()) return query.state?.trim() || undefined;
    return query.state?.trim() || viewer.state;
  }

  private async resolveReturning(
    layout: CatalogExperienceContext['layout'],
    viewer: ViewerGeo
  ): Promise<boolean> {
    if (layout !== 'discovery' || !viewer.userId) return false;
    if (await this.hasRecentViews(viewer.userId)) return true;
    return this.hasCompletedOrder(viewer.clientId);
  }

  private async loadViewer(): Promise<ViewerGeo> {
    try {
      const user = await this.hasuraUser.getUser();
      const primary =
        user.addresses?.find((address) => address.is_primary) ??
        user.addresses?.[0];
      return {
        userId: user.id,
        clientId: user.client?.id,
        country: primary?.country || undefined,
        state: primary?.state || undefined,
      };
    } catch {
      return {};
    }
  }

  private async hasRecentViews(userId: string): Promise<boolean> {
    const result = await this.hasura.executeQuery(
      `query RecentViewExists($viewerId: String!) {
        item_view_events(
          where: { viewer_id: { _eq: $viewerId }, viewer_type: { _eq: "user" } }
          limit: 1
        ) { id }
      }`,
      { viewerId: userId }
    );
    return (result.item_view_events?.length ?? 0) > 0;
  }

  private async hasCompletedOrder(clientId?: string): Promise<boolean> {
    if (!clientId) return false;
    const result = await this.hasura.executeQuery(
      `query CompletedOrderExists($clientId: uuid!, $status: order_status!) {
        orders(
          where: { client_id: { _eq: $clientId }, current_status: { _eq: $status } }
          limit: 1
        ) { id }
      }`,
      { clientId, status: 'complete' }
    );
    return (result.orders?.length ?? 0) > 0;
  }
}
