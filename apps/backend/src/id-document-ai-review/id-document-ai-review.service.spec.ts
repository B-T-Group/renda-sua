import { IdDocumentAiReviewService } from './id-document-ai-review.service';
import { PendingIdUpload } from './id-document-ai-review.types';

describe('IdDocumentAiReviewService', () => {
  function baseUpload(
    overrides: Partial<PendingIdUpload> = {}
  ): PendingIdUpload {
    return {
      id: 'upload-1',
      user_id: 'user-1',
      key: 'business/user-1/1/id.jpg',
      content_type: 'image/jpeg',
      file_name: 'id.jpg',
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      document_type: { name: 'id_card' },
      user: {
        id: 'user-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        business: { id: 'biz-1', name: 'Ada Store' },
        agent: null,
      },
      id_document_ai_reviews: [],
      ...overrides,
    };
  }

  function buildService(opts?: {
    enabled?: boolean;
    uploads?: PendingIdUpload[];
    objectExists?: boolean;
    modelResult?: {
      isIdDocument: boolean;
      extractedName: string | null;
      nameMatches: boolean;
      confidence: number;
      reasons: string[];
    };
    modelError?: Error;
  }) {
    const approveUpload = jest.fn().mockResolvedValue(undefined);
    const notify = jest.fn().mockResolvedValue(undefined);
    const objectExists = jest
      .fn()
      .mockResolvedValue(opts?.objectExists ?? true);
    const reviewIdDocument = jest.fn().mockImplementation(async () => {
      if (opts?.modelError) throw opts.modelError;
      return {
        result: opts?.modelResult ?? {
          isIdDocument: true,
          extractedName: 'Ada Lovelace',
          nameMatches: true,
          confidence: 0.95,
          reasons: ['exact match'],
        },
        modelMeta: {},
      };
    });
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('PendingIdUploadsForAiReview')) {
        return { user_uploads: opts?.uploads ?? [] };
      }
      if (query.includes('LatestSignerLegalName')) {
        return { business_merchant_agreement_acceptances: [] };
      }
      return {};
    });
    const executeMutation = jest.fn(async (query: string) => {
      if (query.includes('InsertIdDocumentAiReviewRunning')) {
        return { insert_id_document_ai_reviews_one: { id: 'review-1' } };
      }
      if (query.includes('CompleteIdDocumentAiReview')) {
        return { update_id_document_ai_reviews_by_pk: { id: 'review-1' } };
      }
      if (query.includes('FailStaleRunningIdReviews')) {
        return { update_id_document_ai_reviews: { affected_rows: 0 } };
      }
      return {};
    });
    const service = new IdDocumentAiReviewService(
      { executeQuery, executeMutation } as any,
      {
        objectExists,
        generatePresignedDownloadUrl: jest
          .fn()
          .mockResolvedValue({ url: 'https://example.com/id.jpg' }),
      } as any,
      { approveUpload } as any,
      { reviewIdDocument } as any,
      { notifySuperusersIdDocumentUploaded: notify } as any,
      {
        get: (key: string) => {
          if (key === 'idDocumentAiReview.enabled') {
            return opts?.enabled ?? true;
          }
          if (key === 'idDocumentAiReview.model') return 'gpt-4.1';
          return undefined;
        },
      } as any
    );
    return {
      service,
      approveUpload,
      notify,
      objectExists,
      reviewIdDocument,
      executeMutation,
    };
  }

  it('auto-approves when the model reports a confident name match', async () => {
    const { service, approveUpload, notify } = buildService({
      uploads: [baseUpload()],
    });
    await service.processPendingBatch();
    expect(approveUpload).toHaveBeenCalledWith('upload-1');
    expect(notify).not.toHaveBeenCalled();
  });

  it('notifies superusers when the name does not match', async () => {
    const { service, approveUpload, notify } = buildService({
      uploads: [baseUpload()],
      modelResult: {
        isIdDocument: true,
        extractedName: 'Grace Hopper',
        nameMatches: false,
        confidence: 0.9,
        reasons: ['different person'],
      },
    });
    await service.processPendingBatch();
    expect(approveUpload).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadId: 'upload-1',
        persona: 'business',
        reason: expect.stringContaining('Grace Hopper'),
      })
    );
  });

  it('sends needs_review for non-image uploads without calling the model', async () => {
    const { service, reviewIdDocument, notify, approveUpload } = buildService({
      uploads: [baseUpload({ content_type: 'application/pdf' })],
    });
    await service.processPendingBatch();
    expect(reviewIdDocument).not.toHaveBeenCalled();
    expect(approveUpload).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Upload is not an image' })
    );
  });

  it('defers when the S3 object is missing and upload is recent', async () => {
    const { service, notify, approveUpload } = buildService({
      uploads: [
        baseUpload({
          created_at: new Date().toISOString(),
        }),
      ],
      objectExists: false,
    });
    await service.processPendingBatch();
    expect(approveUpload).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('needs_review when S3 object is missing for an old upload', async () => {
    const { service, notify } = buildService({
      uploads: [baseUpload()],
      objectExists: false,
    });
    await service.processPendingBatch();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'Uploaded file not found in storage',
      })
    );
  });

  it('needs_review after max failed attempts without calling the model', async () => {
    const { service, reviewIdDocument, notify } = buildService({
      uploads: [
        baseUpload({
          id_document_ai_reviews: [
            {
              id: 'r1',
              status: 'failed',
              decision: null,
              created_at: '2020-01-01T00:00:00Z',
            },
            {
              id: 'r2',
              status: 'failed',
              decision: null,
              created_at: '2020-01-02T00:00:00Z',
            },
          ],
        }),
      ],
    });
    await service.processPendingBatch();
    expect(reviewIdDocument).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'AI review failed after retries',
      })
    );
  });

  it('shouldAutoApprove requires id + match + confidence + expected name', () => {
    const { service } = buildService();
    expect(
      service.shouldAutoApprove(
        {
          isIdDocument: true,
          extractedName: 'Ada Lovelace',
          nameMatches: true,
          confidence: 0.75,
          reasons: [],
        },
        'Ada Lovelace'
      )
    ).toBe(true);
    expect(
      service.shouldAutoApprove(
        {
          isIdDocument: true,
          extractedName: 'Ada Lovelace',
          nameMatches: true,
          confidence: 0.74,
          reasons: [],
        },
        'Ada Lovelace'
      )
    ).toBe(false);
    expect(
      service.shouldAutoApprove(
        {
          isIdDocument: true,
          extractedName: 'Ada Lovelace',
          nameMatches: true,
          confidence: 0.95,
          reasons: [],
        },
        ''
      )
    ).toBe(false);
  });

  it('approves the upload before completing the review row', async () => {
    const callOrder: string[] = [];
    const { service, approveUpload, executeMutation } = buildService({
      uploads: [baseUpload()],
    });
    approveUpload.mockImplementation(async () => {
      callOrder.push('approveUpload');
    });
    executeMutation.mockImplementation(async (query: string) => {
      if (query.includes('InsertIdDocumentAiReviewRunning')) {
        return { insert_id_document_ai_reviews_one: { id: 'review-1' } };
      }
      if (query.includes('CompleteIdDocumentAiReview')) {
        callOrder.push('completeReview');
        return { update_id_document_ai_reviews_by_pk: { id: 'review-1' } };
      }
      if (query.includes('FailStaleRunningIdReviews')) {
        return { update_id_document_ai_reviews: { affected_rows: 0 } };
      }
      return {};
    });
    await service.processPendingBatch();
    expect(callOrder).toEqual(['approveUpload', 'completeReview']);
  });

  it('classifies persona from the S3 key even when the user also has a business', async () => {
    const { service, notify } = buildService({
      uploads: [
        baseUpload({
          key: 'agent/user-1/1/id.jpg',
          content_type: 'application/pdf',
          user: {
            id: 'user-1',
            first_name: 'Ada',
            last_name: 'Lovelace',
            business: { id: 'biz-1', name: 'Ada Store' },
            agent: { id: 'agent-1' },
          },
        }),
      ],
    });
    await service.processPendingBatch();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        persona: 'agent',
        adminUrl: '/admin/agents',
      })
    );
  });
});
