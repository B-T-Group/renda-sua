import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type {
  ContentReportReason,
  ContentReportSubjectType,
} from './dto/submit-content-report.dto';
import type { ResolveContentReportAction } from './dto/resolve-content-report.dto';

const AUTO_HIDE_DISTINCT_REPORTERS = 5;
const REPORTS_PER_USER_PER_DAY = 20;

export type ContentReportRow = {
  id: string;
  subject_type: string;
  subject_id: string;
  reporter_user_id: string;
  reason: string;
  details: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class ContentReportsService {
  private readonly logger = new Logger(ContentReportsService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  async submitReport(params: {
    reporterUserId: string;
    subjectType: ContentReportSubjectType;
    subjectId: string;
    reason: ContentReportReason;
    details?: string;
  }): Promise<ContentReportRow> {
    await this.assertWithinDailyLimit(params.reporterUserId);
    try {
      const result = await this.hasura.executeMutation<{
        insert_content_reports_one: ContentReportRow;
      }>(
        `mutation SubmitContentReport($object: content_reports_insert_input!) {
          insert_content_reports_one(object: $object) {
            id subject_type subject_id reporter_user_id reason details
            status resolution created_at updated_at
          }
        }`,
        {
          object: {
            subject_type: params.subjectType,
            subject_id: params.subjectId,
            reporter_user_id: params.reporterUserId,
            reason: params.reason,
            details: params.details?.trim() || null,
            status: 'pending',
          },
        }
      );
      const row = result.insert_content_reports_one;
      if (!row) {
        throw new BadRequestException('Report already submitted for this content');
      }
      await this.maybeAutoHide(params.subjectType, params.subjectId);
      return row;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      const msg = String(error?.message ?? error);
      if (msg.includes('content_reports_reporter_subject_unique')) {
        throw new BadRequestException('You have already reported this content');
      }
      this.logger.error(`submitReport failed: ${msg}`);
      throw new HttpException(
        { success: false, message: 'Failed to submit report' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async listQueue(params: {
    status?: string;
    page: number;
    limit: number;
  }): Promise<{ rows: ContentReportRow[]; total: number }> {
    const limit = Math.min(Math.max(params.limit, 1), 50);
    const page = Math.max(params.page, 1);
    const offset = (page - 1) * limit;
    const status = params.status ?? 'pending';
    const where = { status: { _eq: status } };
    const [listRes, countRes] = await Promise.all([
      this.hasura.executeQuery<{
        content_reports: ContentReportRow[];
      }>(
        `query ContentReportsQueue($where: content_reports_bool_exp!, $limit: Int!, $offset: Int!) {
          content_reports(
            where: $where
            order_by: { created_at: asc }
            limit: $limit
            offset: $offset
          ) {
            id subject_type subject_id reporter_user_id reason details
            status resolution created_at updated_at
          }
        }`,
        { where, limit, offset }
      ),
      this.hasura.executeQuery<{
        content_reports_aggregate: { aggregate: { count: number } };
      }>(
        `query ContentReportsCount($where: content_reports_bool_exp!) {
          content_reports_aggregate(where: $where) {
            aggregate { count }
          }
        }`,
        { where }
      ),
    ]);
    return {
      rows: listRes.content_reports ?? [],
      total: countRes.content_reports_aggregate?.aggregate?.count ?? 0,
    };
  }

  async resolveReport(params: {
    reportId: string;
    resolverUserId: string;
    action: ResolveContentReportAction;
    resolution?: string;
  }): Promise<ContentReportRow> {
    const status = params.action === 'dismiss' ? 'dismissed' : 'resolved';
    const result = await this.hasura.executeMutation<{
      update_content_reports_by_pk: ContentReportRow | null;
    }>(
      `mutation ResolveContentReport($id: uuid!, $set: content_reports_set_input!) {
        update_content_reports_by_pk(pk_columns: { id: $id }, _set: $set) {
          id subject_type subject_id reporter_user_id reason details
          status resolution created_at updated_at
        }
      }`,
      {
        id: params.reportId,
        set: {
          status,
          resolved_by_user_id: params.resolverUserId,
          resolution: params.resolution?.trim() || params.action,
          updated_at: new Date().toISOString(),
        },
      }
    );
    const row = result.update_content_reports_by_pk;
    if (!row) {
      throw new BadRequestException('Report not found');
    }
    if (params.action === 'hide_content') {
      await this.hideSubject(row.subject_type, row.subject_id);
    }
    return row;
  }

  async blockBusiness(
    blockerUserId: string,
    businessId: string
  ): Promise<{ id: string }> {
    const result = await this.hasura.executeMutation<{
      insert_business_blocks_one: { id: string } | null;
    }>(
      `mutation BlockBusiness($object: business_blocks_insert_input!) {
        insert_business_blocks_one(
          object: $object
          on_conflict: {
            constraint: business_blocks_blocker_business_unique
            update_columns: []
          }
        ) { id }
      }`,
      {
        object: {
          blocker_user_id: blockerUserId,
          business_id: businessId,
        },
      }
    );
    if (!result.insert_business_blocks_one) {
      throw new BadRequestException('Failed to block business');
    }
    return result.insert_business_blocks_one;
  }

  private async assertWithinDailyLimit(userId: string): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const res = await this.hasura.executeQuery<{
      content_reports_aggregate: { aggregate: { count: number } };
    }>(
      `query ReportDailyCount($userId: uuid!, $since: timestamptz!) {
        content_reports_aggregate(
          where: {
            reporter_user_id: { _eq: $userId }
            created_at: { _gte: $since }
          }
        ) { aggregate { count } }
      }`,
      { userId, since }
    );
    const count = res.content_reports_aggregate?.aggregate?.count ?? 0;
    if (count >= REPORTS_PER_USER_PER_DAY) {
      throw new HttpException(
        { success: false, message: 'Daily report limit reached' },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private async maybeAutoHide(
    subjectType: string,
    subjectId: string
  ): Promise<void> {
    const res = await this.hasura.executeQuery<{
      content_reports: Array<{ reporter_user_id: string }>;
    }>(
      `query DistinctReporters($subjectType: content_report_subject_type!, $subjectId: uuid!) {
        content_reports(
          where: {
            subject_type: { _eq: $subjectType }
            subject_id: { _eq: $subjectId }
            status: { _in: [pending, reviewing] }
          }
          distinct_on: reporter_user_id
          order_by: [{ reporter_user_id: asc }]
        ) { reporter_user_id }
      }`,
      { subjectType, subjectId }
    );
    const distinct = res.content_reports?.length ?? 0;
    if (distinct >= AUTO_HIDE_DISTINCT_REPORTERS) {
      await this.hideSubject(subjectType, subjectId);
    }
  }

  private async hideSubject(
    subjectType: string,
    subjectId: string
  ): Promise<void> {
    if (subjectType === 'reel') {
      await this.hasura.executeMutation(
        `mutation HideReel($id: uuid!, $now: timestamptz!) {
          update_reels_by_pk(
            pk_columns: { id: $id }
            _set: { moderation_status: rejected, updated_at: $now }
          ) { id }
        }`,
        { id: subjectId, now: new Date().toISOString() }
      );
      return;
    }
    if (subjectType === 'sale_item') {
      await this.hasura.executeMutation(
        `mutation HideItem($id: uuid!) {
          update_items_by_pk(pk_columns: { id: $id }, _set: { is_active: false }) { id }
        }`,
        { id: subjectId }
      );
    }
    this.logger.log(`hideSubject: ${subjectType}/${subjectId} (no-op or deferred)`);
  }
}
