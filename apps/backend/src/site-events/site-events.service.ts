import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { TrackViewerIdentity } from '../tracking/resolve-track-viewer';
import { TrackSiteEventDto } from './dto/track-site-event.dto';
import {
  SITE_EVENT_SUBJECT_INVENTORY_ITEM,
  SITE_EVENT_TYPES_V1,
} from './site-event-types';
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

const RECENT_DUPLICATE_LOOKUP = `
  query RecentDuplicateLookup(
    $viewerType: String!
    $viewerId: String!
    $eventType: String!
    $subjectType: String!
    $subjectId: uuid!
    $since: timestamptz!
  ) {
    site_events(
      where: {
        viewer_type: { _eq: $viewerType }
        viewer_id: { _eq: $viewerId }
        event_type: { _eq: $eventType }
        subject_type: { _eq: $subjectType }
        subject_id: { _eq: $subjectId }
        created_at: { _gte: $since }
      }
      order_by: [{ created_at: desc }]
      limit: 1
    ) {
      id
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

const COUNT_SITE_EVENTS = `
  query CountSiteEvents($where: site_events_bool_exp!) {
    site_events_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

export type SiteEventSummaryByType = {
  eventType: string;
  count: number;
};

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
    const isDupe = await this.isRecentDuplicate({
      viewerType: viewer.viewerType,
      viewerId: viewer.viewerId,
      eventType: body.eventType,
      subjectType: body.subjectType ?? null,
      subjectId: body.subjectId ?? null,
    });
    if (isDupe) return;
    const object = this.toInsertObject(body, viewer, metadata);
    try {
      await this.hasuraSystemService.executeMutation(INSERT_SITE_EVENT, {
        object,
      });
    } catch (error: any) {
      this.logger.error('Failed to track site event', error);
    }
  }

  private async isRecentDuplicate(input: {
    viewerType: string;
    viewerId: string;
    eventType: string;
    subjectType: string | null;
    subjectId: string | null;
  }): Promise<boolean> {
    // This dedupe rule only makes sense for subject-scoped events.
    if (!input.subjectType || !input.subjectId) return false;

    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    try {
      const res = await this.hasuraSystemService.executeQuery<{
        site_events: Array<{ id: string }>;
      }>(RECENT_DUPLICATE_LOOKUP, {
        viewerType: input.viewerType,
        viewerId: input.viewerId,
        eventType: input.eventType,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        since,
      });
      return (res.site_events?.length ?? 0) > 0;
    } catch (error: any) {
      // If dedupe check fails, still allow tracking (best-effort analytics).
      this.logger.warn('site_event dedupe lookup failed', error);
      return false;
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

  private withEventType(
    where: Record<string, unknown>,
    eventType: string
  ): Record<string, unknown> {
    const et = { event_type: { _eq: eventType } };
    if (!where || Object.keys(where).length === 0) {
      return et;
    }
    const w = where as { _and?: unknown[] };
    if (Array.isArray(w._and)) {
      return { _and: [...w._and, et] };
    }
    return { _and: [where, et] };
  }

  private parseAggCount(
    n: string | number | null | undefined
  ): number {
    if (n == null) {
      return 0;
    }
    return typeof n === 'string' ? parseInt(n, 10) : n;
  }

  private async countSiteEvents(
    where: Record<string, unknown>
  ): Promise<number> {
    const res = await this.hasuraSystemService.executeQuery<{
      site_events_aggregate: { aggregate: { count: number } | null };
    }>(COUNT_SITE_EVENTS, { where });
    return this.parseAggCount(res.site_events_aggregate?.aggregate?.count);
  }

  async getAdminSiteEventsSummary(
    p: Pick<
      AdminSiteEventsListParams,
      'eventType' | 'subjectType' | 'subjectId' | 'from' | 'to'
    >
  ): Promise<{
    total: number;
    byEventType: SiteEventSummaryByType[];
  }> {
    const where = this.adminWhere(p);
    if (p.eventType?.trim()) {
      const c = await this.countSiteEvents(where);
      return { total: c, byEventType: [] };
    }
    const [total, ...v1Counts] = await Promise.all([
      this.countSiteEvents(where),
      ...SITE_EVENT_TYPES_V1.map((et) =>
        this.countSiteEvents(this.withEventType(where, et))
      ),
    ]);
    const byType: SiteEventSummaryByType[] = [];
    SITE_EVENT_TYPES_V1.forEach((et, i) => {
      const c = v1Counts[i] ?? 0;
      if (c > 0) {
        byType.push({ eventType: et, count: c });
      }
    });
    const sumKnown = byType.reduce((a, b) => a + b.count, 0);
    const other = total - sumKnown;
    if (other > 0) {
      byType.push({ eventType: 'other', count: other });
    }
    byType.sort((a, b) => b.count - a.count);
    return { total, byEventType: byType };
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
