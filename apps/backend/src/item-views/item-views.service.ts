import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MetaConversionsService } from '../meta-conversions/meta-conversions.service';
import type { MetaActionSource } from '../meta-conversions/meta-conversions.types';

const TRACK_ITEM_VIEW_MUTATION = `
  mutation TrackItemView($object: item_view_events_insert_input!) {
    insert_item_view_events_one(
      object: $object
      on_conflict: {
        constraint: item_view_events_inventory_item_id_viewer_type_viewer_id_key
        update_columns: [last_viewed_at]
      }
    ) {
      id
    }
  }
`;

export type TrackViewMetaContext = {
  eventId?: string;
  value?: number;
  currency?: string;
  contentName?: string;
  actionSource: MetaActionSource;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string;
  fbp?: string;
  eventSourceUrl?: string;
  allowUserEnrichment?: boolean;
};

@Injectable()
export class ItemViewsService {
  private readonly logger = new Logger(ItemViewsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly metaConversionsService: MetaConversionsService
  ) {}

  async trackView(
    itemId: string,
    viewerType: string,
    viewerId: string,
    meta?: TrackViewMetaContext
  ): Promise<void> {
    try {
      await this.hasuraSystemService.executeMutation(TRACK_ITEM_VIEW_MUTATION, {
        object: {
          inventory_item_id: itemId,
          viewer_type: viewerType,
          viewer_id: viewerId,
          last_viewed_at: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      this.logger.error('Failed to track item view', error);
    }
    this.scheduleViewContent(itemId, viewerId, meta);
  }

  private scheduleViewContent(
    itemId: string,
    viewerId: string,
    meta?: TrackViewMetaContext
  ): void {
    // Only emit Meta ViewContent when the client supplies eventId (paired Pixel
    // / intentional product view). Listing-page track-view clicks omit it.
    if (!meta?.eventId?.trim()) return;
    void this.metaConversionsService.trackViewContentSafe({
      eventId: meta.eventId.trim(),
      actionSource: meta.actionSource ?? 'website',
      inventoryItemId: itemId,
      quantity: 1,
      value: meta.value,
      currency: meta.currency,
      contentName: meta.contentName,
      externalId: viewerId,
      clientIpAddress: meta.clientIpAddress,
      clientUserAgent: meta.clientUserAgent,
      fbc: meta.fbc,
      fbp: meta.fbp,
      eventSourceUrl: meta.eventSourceUrl,
      allowUserEnrichment: meta.allowUserEnrichment === true,
    });
  }
}
