import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ContentReportsService, type ContentReportRow } from './content-reports.service';

describe('ContentReportsService', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };

  let service: ContentReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentReportsService(hasura as never);
  });

  function report(overrides: Partial<ContentReportRow> = {}): ContentReportRow {
    return {
      id: 'rep-1',
      subject_type: 'reel',
      subject_id: 'reel-1',
      reporter_user_id: 'user-1',
      reason: 'spam',
      details: null,
      status: 'pending',
      resolution: null,
      created_at: '2026-09-15T00:00:00.000Z',
      updated_at: '2026-09-15T00:00:00.000Z',
      ...overrides,
    };
  }

  function mockDailyCount(count: number) {
    hasura.executeQuery.mockResolvedValueOnce({
      content_reports_aggregate: { aggregate: { count } },
    });
  }

  describe('submitReport', () => {
    it('rejects a 21st report in 24 hours', async () => {
      mockDailyCount(20);

      const error = await service
        .submitReport({
          reporterUserId: 'user-1',
          subjectType: 'reel',
          subjectId: 'reel-1',
          reason: 'spam',
        })
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS
      );
      expect(hasura.executeMutation).not.toHaveBeenCalled();
    });

    it('maps the unique reporter+subject constraint to a client error', async () => {
      mockDailyCount(0);
      hasura.executeMutation.mockRejectedValueOnce(
        new Error('Uniqueness violation: content_reports_reporter_subject_unique')
      );

      await expect(
        service.submitReport({
          reporterUserId: 'user-1',
          subjectType: 'reel',
          subjectId: 'reel-1',
          reason: 'spam',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores blank details as null and does not auto-hide below 5 reporters', async () => {
      mockDailyCount(1);
      hasura.executeMutation.mockResolvedValueOnce({
        insert_content_reports_one: report({ details: null }),
      });
      hasura.executeQuery.mockResolvedValueOnce({
        content_reports: [{ reporter_user_id: 'user-1' }],
      });

      const row = await service.submitReport({
        reporterUserId: 'user-1',
        subjectType: 'reel',
        subjectId: 'reel-1',
        reason: 'spam',
        details: '   ',
      });

      expect(row.id).toBe('rep-1');
      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('SubmitContentReport'),
        expect.objectContaining({
          object: expect.objectContaining({ details: null, status: 'pending' }),
        })
      );
      expect(hasura.executeMutation).toHaveBeenCalledTimes(1);
    });

    it('auto-hides a reel after five distinct reporters', async () => {
      mockDailyCount(4);
      hasura.executeMutation
        .mockResolvedValueOnce({ insert_content_reports_one: report() })
        .mockResolvedValueOnce({});
      hasura.executeQuery.mockResolvedValueOnce({
        content_reports: [1, 2, 3, 4, 5].map((n) => ({
          reporter_user_id: `user-${n}`,
        })),
      });

      await service.submitReport({
        reporterUserId: 'user-5',
        subjectType: 'reel',
        subjectId: 'reel-1',
        reason: 'inappropriate',
      });

      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('HideReel'),
        expect.objectContaining({ id: 'reel-1' })
      );
    });

    it('treats a null insert as an already-submitted report', async () => {
      mockDailyCount(0);
      hasura.executeMutation.mockResolvedValueOnce({
        insert_content_reports_one: null,
      });

      await expect(
        service.submitReport({
          reporterUserId: 'user-1',
          subjectType: 'reel',
          subjectId: 'reel-1',
          reason: 'spam',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('resolveReport', () => {
    it('hides a reel when action is hide_content', async () => {
      hasura.executeMutation
        .mockResolvedValueOnce({
          update_content_reports_by_pk: report({ status: 'resolved' }),
        })
        .mockResolvedValueOnce({});

      const row = await service.resolveReport({
        reportId: 'rep-1',
        resolverUserId: 'admin-1',
        action: 'hide_content',
      });

      expect(row.status).toBe('resolved');
      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('HideReel'),
        expect.objectContaining({ id: 'reel-1' })
      );
    });

    it('deactivates a sale item when hiding that subject', async () => {
      hasura.executeMutation
        .mockResolvedValueOnce({
          update_content_reports_by_pk: report({
            subject_type: 'sale_item',
            subject_id: 'item-1',
          }),
        })
        .mockResolvedValueOnce({});

      await service.resolveReport({
        reportId: 'rep-1',
        resolverUserId: 'admin-1',
        action: 'hide_content',
      });

      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('HideItem'),
        { id: 'item-1' }
      );
    });

    it('does not hide content when dismissing', async () => {
      hasura.executeMutation.mockResolvedValueOnce({
        update_content_reports_by_pk: report({ status: 'dismissed' }),
      });

      await service.resolveReport({
        reportId: 'rep-1',
        resolverUserId: 'admin-1',
        action: 'dismiss',
      });

      expect(hasura.executeMutation).toHaveBeenCalledTimes(1);
      expect(hasura.executeMutation.mock.calls[0][0]).toContain(
        'ResolveContentReport'
      );
    });

    it('rejects a missing report', async () => {
      hasura.executeMutation.mockResolvedValueOnce({
        update_content_reports_by_pk: null,
      });

      await expect(
        service.resolveReport({
          reportId: 'missing',
          resolverUserId: 'admin-1',
          action: 'dismiss',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('blockBusiness', () => {
    it('rejects a conflict no-op insert', async () => {
      hasura.executeMutation.mockResolvedValueOnce({
        insert_business_blocks_one: null,
      });

      await expect(service.blockBusiness('user-1', 'biz-1')).rejects.toBeInstanceOf(
        BadRequestException
      );
    });
  });
});
