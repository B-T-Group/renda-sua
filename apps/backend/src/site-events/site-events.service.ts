import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { TrackViewerIdentity } from '../tracking/resolve-track-viewer';
import { TrackSiteEventDto } from './dto/track-site-event.dto';
import { SITE_EVENT_SUBJECT_INVENTORY_ITEM } from './site-event-types';
import { csvLine } from './site-events-csv.util';

export interface SiteEventAdminRow {
  id: string;
  event_type: string;
  subject_type: string | null;
  subject_id: string | null;
  metadata: Record<string, unknown>;
  viewer_type: string;
  viewer_id: string;
  created_at: string;
}

export interface AdminSiteEventsListParams {
  limit: number;
  offset: number;
  eventType?: string;
  subjectType?: string;
  subjectId?: string;
  from?: string;
  to?: string;
}

const EXPORT_MAX_ROWS = 25_000;

const LIST_SITE_EVENTS = `
  query AdminListSiteEvents(
    $where: site_events_bool_exp!
    $limit: Int!
    $offset: Int!
    $order_by: [site_events_order_by!]!
  ) {
    site_events(
      where: $where
      limit: $limit
      offset: $offset
      order_by: $order_by
    ) {
      id
      event_type
      subject_type
      subject_id
      metadata
      viewer_type
      viewer_id
      created_at
    }
    site_events_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

const EXPORT_SITE_EVENTS = `
  query AdminExportSiteEvents(
    $where: site_events_bool_exp!
    $limit: Int!
    $order_by: [site_events_order_by!]!
  ) {
    site_events(where: $where, limit: $limit, order_by: $order_by) {
      id
      event_type
      subject_type
      subject_id
      metadata
      viewer_type
      viewer_id
      created_at
    }
  }
`;

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

  private adminWhere(
    p: Pick<
      AdminSiteEventsListParams,
      'eventType' | 'subjectType' | 'subjectId' | 'from' | 'to'
    >
  ): Record<string, unknown> {
    const parts: Record<string, unknown>[] = [];
    const et = p.eventType?.trim();
    if (et) parts.push({ event_type: { _eq: et } });
    const st = p.subjectType?.trim();
    if (st) parts.push({ subject_type: { _eq: st } });
    if (p.subjectId) parts.push({ subject_id: { _eq: p.subjectId } });
    if (p.from) parts.push({ created_at: { _gte: p.from } });
    if (p.to) parts.push({ created_at: { _lte: p.to } });
    return parts.length ? { _and: parts } : {};
  }

  async listSiteEventsForAdmin(params: AdminSiteEventsListParams): Promise<{
    items: SiteEventAdminRow[];
    total: number;
  }> {
    const where = this.adminWhere(params);
    const limit = Math.min(params.limit, 100);
    const offset = params.offset;
    const res = await this.hasuraSystemService.executeQuery<{
      site_events: SiteEventAdminRow[];
      site_events_aggregate: { aggregate: { count: number } | null };
    }>(LIST_SITE_EVENTS, {
      where,
      limit,
      offset,
      order_by: [{ created_at: 'desc' }],
    });
    const rawCount = res.site_events_aggregate?.aggregate?.count;
    const total =
      typeof rawCount === 'string'
        ? parseInt(rawCount, 10)
        : rawCount ?? 0;
    return { items: res.site_events ?? [], total };
  }

  async exportSiteEventsCsv(
    p: Pick<
      AdminSiteEventsListParams,
      'eventType' | 'subjectType' | 'subjectId' | 'from' | 'to'
    >
  ): Promise<string> {
    const where = this.adminWhere(p);
    const res = await this.hasuraSystemService.executeQuery<{
      site_events: SiteEventAdminRow[];
    }>(EXPORT_SITE_EVENTS, {
      where,
      limit: EXPORT_MAX_ROWS,
      order_by: [{ created_at: 'desc' }],
    });
    const rows = res.site_events ?? [];
    const header = csvLine([
      'id',
      'event_type',
      'subject_type',
      'subject_id',
      'metadata_json',
      'viewer_type',
      'viewer_id',
      'created_at',
    ]);
    const lines = rows.map((r) =>
      csvLine([
        r.id,
        r.event_type,
        r.subject_type ?? '',
        r.subject_id ?? '',
        JSON.stringify(r.metadata ?? {}),
        r.viewer_type,
        r.viewer_id,
        r.created_at,
      ])
    );
    return [header, ...lines].join('\r\n');
  }
}
