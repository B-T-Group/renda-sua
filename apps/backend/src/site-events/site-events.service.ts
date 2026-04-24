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
  /** Resolved catalog name when subject is an inventory row */
  subject_display_name?: string | null;
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

export type SiteEventSummaryByInventoryItem = {
  inventoryItemId: string;
  itemName: string | null;
  count: number;
};

export type AdminSiteEventsSummaryResult = {
  total: number;
  groupBy: 'eventType' | 'inventoryItem';
  byEventType: SiteEventSummaryByType[];
  byInventoryItem: SiteEventSummaryByInventoryItem[];
  inventoryEventTotal: number;
  inventorySummaryTruncated: boolean;
};

const BATCH_SITE_EVENT_SUBJECT_IDS = `
  query BatchSiteEventSubjects(
    $where: site_events_bool_exp!
    $limit: Int!
    $offset: Int!
  ) {
    site_events(
      where: $where
      limit: $limit
      offset: $offset
      order_by: [{ created_at: asc }, { id: asc }]
    ) {
      subject_id
    }
  }
`;

const LOOKUP_INVENTORY_NAMES = `
  query LookupInventoryNames($ids: [uuid!]!) {
    business_inventory(where: { id: { _in: $ids } }) {
      id
      item {
        name
      }
    }
  }
`;

const INVENTORY_AGG_BATCH = 8000;
const INVENTORY_AGG_MAX_BATCHES = 500;

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

  private mergeWhereClauses(
    clauses: Record<string, unknown>[]
  ): Record<string, unknown> {
    const clean = clauses.filter((c) => c && Object.keys(c).length > 0);
    if (clean.length === 0) {
      return {};
    }
    if (clean.length === 1) {
      return clean[0];
    }
    return { _and: clean };
  }

  private withInventorySubjectFilter(
    base: Record<string, unknown>
  ): Record<string, unknown> {
    return this.mergeWhereClauses([
      base,
      {
        subject_type: { _eq: SITE_EVENT_SUBJECT_INVENTORY_ITEM },
        subject_id: { _is_null: false },
      },
    ]);
  }

  private async resolveInventoryNamesInChunks(
    ids: string[]
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const unique = [...new Set(ids)].filter(Boolean);
    const CHUNK = 120;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const slice = unique.slice(i, i + CHUNK);
      const res = await this.hasuraSystemService.executeQuery<{
        business_inventory: Array<{
          id: string;
          item: { name: string } | null;
        }>;
      }>(LOOKUP_INVENTORY_NAMES, { ids: slice });
      for (const row of res.business_inventory ?? []) {
        out.set(row.id, row.item?.name ?? '');
      }
    }
    return out;
  }

  private async enrichAdminRows(
    rows: SiteEventAdminRow[]
  ): Promise<SiteEventAdminRow[]> {
    const ids = rows
      .filter(
        (r) =>
          r.subject_type === SITE_EVENT_SUBJECT_INVENTORY_ITEM && r.subject_id
      )
      .map((r) => r.subject_id as string);
    if (ids.length === 0) {
      return rows;
    }
    const names = await this.resolveInventoryNamesInChunks(ids);
    return rows.map((r) => {
      if (
        r.subject_type !== SITE_EVENT_SUBJECT_INVENTORY_ITEM ||
        !r.subject_id
      ) {
        return r;
      }
      const nm = names.get(r.subject_id);
      return {
        ...r,
        subject_display_name: nm && nm.length > 0 ? nm : null,
      };
    });
  }

  private async buildInventorySubjectCountMap(
    where: Record<string, unknown>
  ): Promise<{ counts: Map<string, number>; truncated: boolean }> {
    const counts = new Map<string, number>();
    let truncated = false;
    for (let b = 0; b < INVENTORY_AGG_MAX_BATCHES; b++) {
      const offset = b * INVENTORY_AGG_BATCH;
      const res = await this.hasuraSystemService.executeQuery<{
        site_events: Array<{ subject_id: string | null }>;
      }>(BATCH_SITE_EVENT_SUBJECT_IDS, {
        where,
        limit: INVENTORY_AGG_BATCH,
        offset,
      });
      const batch = res.site_events ?? [];
      for (const row of batch) {
        if (row.subject_id) {
          counts.set(
            row.subject_id,
            (counts.get(row.subject_id) ?? 0) + 1
          );
        }
      }
      if (batch.length < INVENTORY_AGG_BATCH) {
        return { counts, truncated: false };
      }
    }
    truncated = true;
    return { counts, truncated };
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
    >,
    groupBy: 'eventType' | 'inventoryItem'
  ): Promise<AdminSiteEventsSummaryResult> {
    const where = this.adminWhere(p);
    const total = await this.countSiteEvents(where);
    if (groupBy === 'inventoryItem') {
      return this.summaryByInventoryItems(p, where, total);
    }
    return this.summaryByEventType(p, where, total);
  }

  private async summaryByInventoryItems(
    p: Pick<
      AdminSiteEventsListParams,
      'eventType' | 'subjectType' | 'subjectId' | 'from' | 'to'
    >,
    where: Record<string, unknown>,
    total: number
  ): Promise<AdminSiteEventsSummaryResult> {
    const whereInv = this.withInventorySubjectFilter(where);
    const inventoryEventTotal = await this.countSiteEvents(whereInv);
    const { counts, truncated } =
      await this.buildInventorySubjectCountMap(whereInv);
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    const names = await this.resolveInventoryNamesInChunks(
      sorted.map(([id]) => id)
    );
    const byInventoryItem: SiteEventSummaryByInventoryItem[] = sorted.map(
      ([inventoryItemId, count]) => ({
        inventoryItemId,
        itemName: names.get(inventoryItemId) || null,
        count,
      })
    );
    return {
      total,
      groupBy: 'inventoryItem',
      byEventType: [],
      byInventoryItem,
      inventoryEventTotal,
      inventorySummaryTruncated: truncated,
    };
  }

  private async summaryByEventType(
    p: Pick<
      AdminSiteEventsListParams,
      'eventType' | 'subjectType' | 'subjectId' | 'from' | 'to'
    >,
    where: Record<string, unknown>,
    total: number
  ): Promise<AdminSiteEventsSummaryResult> {
    if (p.eventType?.trim()) {
      return {
        total,
        groupBy: 'eventType',
        byEventType: [],
        byInventoryItem: [],
        inventoryEventTotal: 0,
        inventorySummaryTruncated: false,
      };
    }
    const v1Counts = await Promise.all(
      SITE_EVENT_TYPES_V1.map((et) =>
        this.countSiteEvents(this.withEventType(where, et))
      )
    );
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
    return {
      total,
      groupBy: 'eventType',
      byEventType: byType,
      byInventoryItem: [],
      inventoryEventTotal: 0,
      inventorySummaryTruncated: false,
    };
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
    const items = await this.enrichAdminRows(res.site_events ?? []);
    return { items, total };
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
    const rows = await this.enrichAdminRows(res.site_events ?? []);
    const header = csvLine([
      'id',
      'event_type',
      'subject_type',
      'subject_id',
      'subject_display_name',
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
        r.subject_display_name ?? '',
        JSON.stringify(r.metadata ?? {}),
        r.viewer_type,
        r.viewer_id,
        r.created_at,
      ])
    );
    return [header, ...lines].join('\r\n');
  }
}
