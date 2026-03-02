import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

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

@Injectable()
export class ItemViewsService {
  private readonly logger = new Logger(ItemViewsService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async trackView(
    itemId: string,
    viewerType: string,
    viewerId: string
  ): Promise<void> {
    try {
      await this.hasuraSystemService.executeMutation(
        TRACK_ITEM_VIEW_MUTATION,
        {
          object: {
            inventory_item_id: itemId,
            viewer_type: viewerType,
            viewer_id: viewerId,
            last_viewed_at: new Date().toISOString(),
          },
        }
      );
    } catch (error: any) {
      this.logger.error('Failed to track item view', error);
    }
  }
}

