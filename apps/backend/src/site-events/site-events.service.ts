import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { TrackViewerIdentity } from '../tracking/resolve-track-viewer';
import { TrackSiteEventDto } from './dto/track-site-event.dto';
import { SITE_EVENT_SUBJECT_INVENTORY_ITEM } from './site-event-types';

const INSERT_SITE_EVENT = `
  mutation InsertSiteEvent($object: site_events_insert_input!) {
    insert_site_events_one(object: $object) {
      id
    }
  }
`;

const MAX_METADATA_KEYS = 20;
const MAX_METADATA_CHARS = 4000;

@Injectable()
export class SiteEventsService {
  private readonly logger = new Logger(SiteEventsService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  private normalizeMetadata(
    metadata?: Record<string, unknown>
  ): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }
    const keys = Object.keys(metadata).slice(0, MAX_METADATA_KEYS);
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      out[k] = metadata[k];
    }
    const s = JSON.stringify(out);
    if (s.length > MAX_METADATA_CHARS) {
      throw new BadRequestException('metadata too large');
    }
    return out;
  }

  private assertV1Subject(body: TrackSiteEventDto): void {
    const ok =
      body.subjectType === SITE_EVENT_SUBJECT_INVENTORY_ITEM &&
      Boolean(body.subjectId);
    if (!ok) {
      throw new BadRequestException(
        'subjectType must be inventory_item and subjectId required'
      );
    }
  }

  private toInsertObject(
    body: TrackSiteEventDto,
    viewer: TrackViewerIdentity,
    metadata: Record<string, unknown>
  ) {
    return {
      event_type: body.eventType,
      subject_type: body.subjectType ?? null,
      subject_id: body.subjectId ?? null,
      metadata,
      viewer_type: viewer.viewerType,
      viewer_id: viewer.viewerId,
    };
  }

  async trackEvent(
    body: TrackSiteEventDto,
    viewer: TrackViewerIdentity
  ): Promise<void> {
    this.assertV1Subject(body);
    const metadata = this.normalizeMetadata(body.metadata);
    const object = this.toInsertObject(body, viewer, metadata);
    try {
      await this.hasuraSystemService.executeMutation(INSERT_SITE_EVENT, {
        object,
      });
    } catch (error: any) {
      this.logger.error('Failed to track site event', error);
    }
  }
}
