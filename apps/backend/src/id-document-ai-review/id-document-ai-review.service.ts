import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AwsService } from '../aws/aws.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ID_DOCUMENT_TYPE_NAMES,
  UploadService,
} from '../services/upload.service';
import { IdDocumentAiReviewModelService } from './id-document-ai-review-model.service';
import * as Q from './id-document-ai-review.queries';
import {
  ID_AI_MIN_CONFIDENCE,
  ID_DOCUMENT_PROMPT_VERSION,
  IdDocumentModelResult,
  IdDocumentPersona,
  IdDocumentReviewContext,
  PendingIdUpload,
} from './id-document-ai-review.types';

const USER_UPLOADS_BUCKET = 'rendasua-user-uploads';
const LOOKBACK_DAYS = 14;
const BATCH_LIMIT = 20;
const MAX_FAILED_ATTEMPTS = 2;
const S3_WAIT_MINUTES = 15;
const STALE_RUNNING_MINUTES = 30;

@Injectable()
export class IdDocumentAiReviewService {
  private readonly logger = new Logger(IdDocumentAiReviewService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly awsService: AwsService,
    private readonly uploadService: UploadService,
    private readonly model: IdDocumentAiReviewModelService,
    private readonly notifications: NotificationsService,
    private readonly configService: ConfigService
  ) {}

  isEnabled(): boolean {
    return this.configService.get<boolean>('idDocumentAiReview.enabled') === true;
  }

  async processPendingBatch(): Promise<void> {
    await this.failStaleRunningReviews();
    const uploads = await this.fetchPendingUploads();
    for (const upload of uploads) {
      await this.processUploadSafe(upload);
    }
  }

  private async processUploadSafe(upload: PendingIdUpload): Promise<void> {
    try {
      await this.processUpload(upload);
    } catch (error: any) {
      this.logger.error(
        `ID AI review failed for ${upload.id}: ${error?.message ?? error}`
      );
      await this.recordUnexpectedFailure(
        upload,
        error?.message ?? String(error)
      );
    }
  }

  private async processUpload(upload: PendingIdUpload): Promise<void> {
    const earlyReason = this.earlyNeedsReviewReason(upload);
    if (earlyReason) {
      await this.finishNeedsReview(upload, earlyReason);
      return;
    }
    let exists: boolean;
    try {
      exists = await this.awsService.objectExists(
        USER_UPLOADS_BUCKET,
        upload.key
      );
    } catch (error: any) {
      await this.recordUnexpectedFailure(
        upload,
        `S3 existence check failed: ${error?.message ?? error}`
      );
      return;
    }
    if (!exists) {
      await this.handleMissingObject(upload);
      return;
    }
    if (!this.isEnabled()) {
      await this.finishNeedsReview(upload, 'AI ID review disabled');
      return;
    }
    await this.runModelAndApply(upload);
  }

  private earlyNeedsReviewReason(upload: PendingIdUpload): string | null {
    if (this.countFailedAttempts(upload) >= MAX_FAILED_ATTEMPTS) {
      return 'AI review failed after retries';
    }
    if (!this.isImageContentType(upload.content_type)) {
      return 'Upload is not an image';
    }
    return null;
  }

  private async handleMissingObject(upload: PendingIdUpload): Promise<void> {
    const ageMs = Date.now() - new Date(upload.created_at).getTime();
    if (ageMs < S3_WAIT_MINUTES * 60 * 1000) return;
    await this.finishNeedsReview(upload, 'Uploaded file not found in storage');
  }

  private async runModelAndApply(upload: PendingIdUpload): Promise<void> {
    const ctx = await this.buildContext(upload);
    if (!ctx.expectedName.trim()) {
      await this.finishNeedsReview(
        upload,
        'Account holder name is missing; cannot verify ID match'
      );
      return;
    }
    const reviewId = await this.tryClaimRunningReview(ctx);
    if (!reviewId) return;
    try {
      const imageUrl = await this.presignedImageUrl(upload.key);
      const { result } = await this.model.reviewIdDocument({
        imageUrl,
        expectedName: ctx.expectedName,
        alternateNames: ctx.alternateNames,
        documentType: upload.document_type.name,
      });
      await this.applyModelResult(ctx, reviewId, result);
    } catch (error: any) {
      await this.failReview(reviewId, error?.message ?? String(error));
      this.logger.error(
        `ID AI model path failed for ${upload.id}: ${error?.message ?? error}`
      );
    }
  }

  private async applyModelResult(
    ctx: IdDocumentReviewContext,
    reviewId: string,
    result: IdDocumentModelResult
  ): Promise<void> {
    if (this.shouldAutoApprove(result, ctx.expectedName)) {
      await this.approveAndComplete(ctx, reviewId, result);
      return;
    }
    const reason = this.needsReviewReason(result, ctx.expectedName);
    await this.completeReview(reviewId, 'needs_review', result, reason);
    await this.notifySuperusers(ctx, reason);
  }

  private async approveAndComplete(
    ctx: IdDocumentReviewContext,
    reviewId: string,
    result: IdDocumentModelResult
  ): Promise<void> {
    await this.uploadService.approveUpload(ctx.upload.id);
    try {
      await this.completeReview(reviewId, 'approve', result);
    } catch (error: any) {
      this.logger.error(
        `Upload ${ctx.upload.id} approved but review ${reviewId} complete failed: ${error?.message ?? error}`
      );
    }
  }

  shouldAutoApprove(
    result: IdDocumentModelResult,
    expectedName: string
  ): boolean {
    if (!expectedName.trim()) return false;
    return (
      result.isIdDocument &&
      result.nameMatches &&
      result.confidence >= ID_AI_MIN_CONFIDENCE
    );
  }

  private needsReviewReason(
    result: IdDocumentModelResult,
    expectedName: string
  ): string {
    if (!expectedName.trim()) {
      return 'Account holder name is missing; cannot verify ID match';
    }
    if (!result.isIdDocument) return 'Image does not appear to be an ID document';
    if (!result.nameMatches) {
      return result.extractedName
        ? `Name on ID ("${result.extractedName}") did not match account holder`
        : 'Could not confirm name on ID matches account holder';
    }
    if (result.confidence < ID_AI_MIN_CONFIDENCE) {
      return `AI confidence too low (${result.confidence.toFixed(2)})`;
    }
    return result.reasons[0] || 'Needs manual review';
  }

  private async finishNeedsReview(
    upload: PendingIdUpload,
    reason: string
  ): Promise<void> {
    const ctx = await this.buildContext(upload);
    const reviewId = await this.tryClaimRunningReview(ctx);
    if (!reviewId) return;
    await this.completeReview(reviewId, 'needs_review', null, reason);
    await this.notifySuperusers(ctx, reason);
  }

  private async fetchPendingUploads(): Promise<PendingIdUpload[]> {
    const createdAfter = new Date(
      Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const result = await this.hasura.executeQuery<{
      user_uploads: PendingIdUpload[];
    }>(Q.PENDING_ID_UPLOADS_FOR_AI_REVIEW, {
      documentTypeNames: ID_DOCUMENT_TYPE_NAMES,
      createdAfter,
      limit: BATCH_LIMIT,
    });
    return result.user_uploads ?? [];
  }

  private async failStaleRunningReviews(): Promise<void> {
    const staleBefore = new Date(
      Date.now() - STALE_RUNNING_MINUTES * 60 * 1000
    ).toISOString();
    await this.hasura.executeMutation(Q.FAIL_STALE_RUNNING_ID_REVIEWS, {
      staleBefore,
      error: `Stuck in running for over ${STALE_RUNNING_MINUTES} minutes`,
      completedAt: new Date().toISOString(),
    });
  }

  private async buildContext(
    upload: PendingIdUpload
  ): Promise<IdDocumentReviewContext> {
    const persona = this.resolvePersona(upload);
    const expectedName = this.formatName(
      upload.user.first_name,
      upload.user.last_name
    );
    const alternateNames = await this.loadAlternateNames(upload, persona);
    return {
      upload,
      persona,
      expectedName,
      alternateNames,
      displayName: this.displayNameFor(upload, persona, expectedName),
      adminUrl:
        persona === 'business' ? '/admin/businesses' : '/admin/agents',
    };
  }

  private resolvePersona(upload: PendingIdUpload): IdDocumentPersona {
    if (upload.key.startsWith('agent/')) return 'agent';
    if (upload.key.startsWith('business/')) return 'business';
    if (upload.user.agent?.id && !upload.user.business?.id) return 'agent';
    if (upload.user.business?.id) return 'business';
    return 'business';
  }

  private displayNameFor(
    upload: PendingIdUpload,
    persona: IdDocumentPersona,
    expectedName: string
  ): string {
    if (persona === 'business') {
      return upload.user.business?.name?.trim() || expectedName || 'Business';
    }
    return expectedName || 'Agent';
  }

  private async loadAlternateNames(
    upload: PendingIdUpload,
    persona: IdDocumentPersona
  ): Promise<string[]> {
    if (persona !== 'business' || !upload.user.business?.id) return [];
    const result = await this.hasura.executeQuery<{
      business_merchant_agreement_acceptances: Array<{
        signer_legal_name?: string | null;
      }>;
    }>(Q.LATEST_SIGNER_LEGAL_NAME, { businessId: upload.user.business.id });
    const signer =
      result.business_merchant_agreement_acceptances?.[0]?.signer_legal_name?.trim();
    if (!signer) return [];
    const expected = this.formatName(
      upload.user.first_name,
      upload.user.last_name
    );
    return signer.toLowerCase() === expected.toLowerCase() ? [] : [signer];
  }

  private formatName(first?: string | null, last?: string | null): string {
    return [first, last].filter(Boolean).join(' ').trim();
  }

  private countFailedAttempts(upload: PendingIdUpload): number {
    return (upload.id_document_ai_reviews ?? []).filter(
      (r) => r.status === 'failed'
    ).length;
  }

  private isImageContentType(contentType: string): boolean {
    return (contentType || '').toLowerCase().startsWith('image/');
  }

  private async presignedImageUrl(key: string): Promise<string> {
    const res = await this.awsService.generatePresignedDownloadUrl({
      bucketName: USER_UPLOADS_BUCKET,
      key,
      expiresIn: 3600,
    });
    return res.url;
  }

  private async createRunningReview(
    ctx: IdDocumentReviewContext
  ): Promise<string> {
    const model =
      this.configService.get<string>('idDocumentAiReview.model')?.trim() ||
      'gpt-4.1';
    const result = await this.hasura.executeMutation<{
      insert_id_document_ai_reviews_one: { id: string };
    }>(Q.INSERT_ID_DOCUMENT_AI_REVIEW_RUNNING, {
      uploadId: ctx.upload.id,
      userId: ctx.upload.user_id,
      persona: ctx.persona,
      expectedName: ctx.expectedName,
      promptVersion: ID_DOCUMENT_PROMPT_VERSION,
      model,
    });
    return result.insert_id_document_ai_reviews_one.id;
  }

  private async tryClaimRunningReview(
    ctx: IdDocumentReviewContext
  ): Promise<string | null> {
    try {
      return await this.createRunningReview(ctx);
    } catch (error: any) {
      if (this.isUniqueViolation(error)) {
        this.logger.warn(
          `Skipping upload ${ctx.upload.id}: already claimed for AI review`
        );
        return null;
      }
      throw error;
    }
  }

  private isUniqueViolation(error: any): boolean {
    const message = String(error?.message ?? error ?? '').toLowerCase();
    return (
      message.includes('unique') ||
      message.includes('duplicate') ||
      message.includes('idx_id_document_ai_reviews_active_upload')
    );
  }

  private async recordUnexpectedFailure(
    upload: PendingIdUpload,
    error: string
  ): Promise<void> {
    try {
      const ctx = await this.buildContext(upload);
      await this.hasura.executeMutation(Q.INSERT_ID_DOCUMENT_AI_REVIEW_FAILED, {
        uploadId: upload.id,
        userId: upload.user_id,
        persona: ctx.persona,
        expectedName: ctx.expectedName || null,
        promptVersion: ID_DOCUMENT_PROMPT_VERSION,
        error,
        completedAt: new Date().toISOString(),
      });
    } catch (recordError: any) {
      this.logger.error(
        `Failed to record ID AI failure for ${upload.id}: ${recordError?.message ?? recordError}`
      );
    }
  }

  private async completeReview(
    reviewId: string,
    decision: 'approve' | 'needs_review',
    result: IdDocumentModelResult | null,
    error?: string
  ): Promise<void> {
    await this.hasura.executeMutation(Q.COMPLETE_ID_DOCUMENT_AI_REVIEW, {
      id: reviewId,
      status: 'completed',
      decision,
      extractedName: result?.extractedName ?? null,
      confidence: result?.confidence ?? null,
      reasons: result?.reasons ?? (error ? [error] : []),
      error: error ?? null,
      completedAt: new Date().toISOString(),
    });
  }

  private async failReview(reviewId: string, error: string): Promise<void> {
    await this.hasura.executeMutation(Q.COMPLETE_ID_DOCUMENT_AI_REVIEW, {
      id: reviewId,
      status: 'failed',
      decision: null,
      extractedName: null,
      confidence: null,
      reasons: null,
      error,
      completedAt: new Date().toISOString(),
    });
  }

  private async notifySuperusers(
    ctx: IdDocumentReviewContext,
    reason: string
  ): Promise<void> {
    await this.notifications.notifySuperusersIdDocumentUploaded({
      userId: ctx.upload.user_id,
      displayName: ctx.displayName,
      persona: ctx.persona,
      documentType: ctx.upload.document_type.name,
      uploadId: ctx.upload.id,
      reason,
      adminUrl: ctx.adminUrl,
    });
  }
}
