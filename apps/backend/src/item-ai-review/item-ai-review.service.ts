import { PutObjectCommand } from '@aws-sdk/client-s3';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai/ai.service';
import { AwsService } from '../aws/aws.service';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ItemActivationValidationService } from '../image-validation/item-activation-validation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { ItemAiReviewModelService } from './item-ai-review-model.service';
import { ItemAiReviewQueueService } from './item-ai-review-queue.service';
import * as Q from './item-ai-review.queries';
import {
  AiReviewModelResult,
  ItemForAiReview,
  PROMPT_VERSION,
} from './item-ai-review.types';

@Injectable()
export class ItemAiReviewService {
  private readonly logger = new Logger(ItemAiReviewService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly queue: ItemAiReviewQueueService,
    private readonly model: ItemAiReviewModelService,
    private readonly notifications: NotificationsService,
    private readonly aiService: AiService,
    private readonly awsService: AwsService,
    private readonly configService: ConfigService<Configuration>,
    private readonly activationValidation: ItemActivationValidationService,
    private readonly merchantLifecycleService: MerchantLifecycleService
  ) {}

  isEnabled(): boolean {
    return (
      this.configService.get('itemAiReview')?.enabled === true ||
      process.env.ITEM_AI_AUTO_REVIEW_ENABLED === 'true'
    );
  }

  async requestReview(itemId: string): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug(`AI review disabled; skip enqueue for ${itemId}`);
      return;
    }
    const claimed = await this.claimForReview(itemId);
    if (!claimed) return;
    const enqueued = await this.queue.enqueueItemReview(itemId, claimed.version);
    if (!enqueued) {
      await this.failToPendingIfAiReviewing(
        itemId,
        'SQS enqueue failed after claim'
      );
    }
  }

  /** Move a rejected item back to pending and enqueue AI review when enabled. */
  async resubmitIfRejected(itemId: string): Promise<boolean> {
    const result = await this.hasura.executeQuery<{
      items_by_pk: { id: string; moderation_status: string } | null;
    }>(Q.GET_ITEM_MODERATION_STATUS, { id: itemId });
    if (result.items_by_pk?.moderation_status !== 'rejected') {
      return false;
    }
    const reset = await this.hasura.executeMutation<{
      update_items_by_pk: { id: string } | null;
    }>(Q.RESET_ITEM_PENDING, { id: itemId });
    if (!reset.update_items_by_pk) {
      throw new HttpException(
        'Failed to resubmit item for review',
        HttpStatus.BAD_REQUEST
      );
    }
    void this.requestReview(itemId);
    return true;
  }

  async runReview(
    itemId: string,
    expectedVersion?: number
  ): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    if (!this.isEnabled()) return { success: true, skipped: true };
    try {
      await this.executeReview(itemId, expectedVersion);
      return { success: true };
    } catch (error: any) {
      if (this.isStaleOrConflict(error)) {
        this.logger.warn(
          `AI review skipped for ${itemId}: ${error?.message ?? error}`
        );
        return { success: true, skipped: true };
      }
      this.logger.error(
        `AI review failed for ${itemId}: ${error?.message ?? error}`,
        error?.stack
      );
      await this.failToPendingIfAiReviewing(
        itemId,
        error?.message ?? 'AI review failed'
      );
      return { success: false, error: error?.message ?? String(error) };
    }
  }

  private isStaleOrConflict(error: unknown): boolean {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      return status === HttpStatus.CONFLICT || status === HttpStatus.NOT_FOUND;
    }
    return false;
  }

  private async claimForReview(
    itemId: string
  ): Promise<{ version: number } | null> {
    const result = await this.hasura.executeMutation<{
      update_items: {
        returning: Array<{ id: string; ai_review_version: number }>;
      };
    }>(Q.SET_ITEM_AI_REVIEWING, { id: itemId });
    const row = result.update_items?.returning?.[0];
    if (!row) {
      this.logger.warn(`Could not claim item ${itemId} for AI review`);
      return null;
    }
    return { version: row.ai_review_version };
  }

  private async executeReview(
    itemId: string,
    expectedVersion?: number
  ): Promise<void> {
    const item = await this.loadItem(itemId);
    this.assertReviewable(item, expectedVersion);
    if (this.hasBlockingImageErrors(item)) {
      await this.applyRejectDecision(
        item,
        await this.createRunningReview(item),
        this.hardBlockResult(item),
        { provider: 'prefilter', model: 'validation_errors' }
      );
      return;
    }
    const reviewId = await this.createRunningReview(item);
    const { result, modelMeta } = await this.model.reviewItem(item);
    await this.applyDecision(item, reviewId, result, modelMeta);
  }

  private assertReviewable(
    item: ItemForAiReview,
    expectedVersion?: number
  ): void {
    if (item.moderation_status !== 'ai_reviewing') {
      throw new HttpException(
        `Item not in ai_reviewing (status=${item.moderation_status})`,
        HttpStatus.CONFLICT
      );
    }
    if (expectedVersion != null && item.ai_review_version !== expectedVersion) {
      throw new HttpException('Stale AI review version', HttpStatus.CONFLICT);
    }
  }

  private hasBlockingImageErrors(item: ItemForAiReview): boolean {
    return (item.item_images ?? []).some((img) => {
      const errs = img.validation_errors;
      return Array.isArray(errs) && errs.length > 0;
    });
  }

  private hardBlockResult(item: ItemForAiReview): AiReviewModelResult {
    return {
      decision: 'reject',
      reason:
        'One or more images failed quality/safety validation. Please upload different images.',
      issues: [
        {
          field: 'images',
          code: 'VALIDATION_ERRORS',
          message: 'Image validation errors present',
        },
      ],
      proposedTitle: null,
      proposedDescription: null,
      imageActions: (item.item_images ?? []).map((img) => ({
        imageId: img.id,
        action: 'replace_required' as const,
        note: 'Failed validation',
      })),
    };
  }

  private async loadItem(itemId: string): Promise<ItemForAiReview> {
    const r = await this.hasura.executeQuery<{
      items_by_pk: ItemForAiReview | null;
    }>(Q.ITEM_FOR_AI_REVIEW, { id: itemId });
    const row = r.items_by_pk;
    if (!row) {
      throw new HttpException('Item not found', HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async createRunningReview(item: ItemForAiReview): Promise<string> {
    const snapshot = {
      title: item.name,
      description: item.description,
      price: item.price,
      currency: item.currency,
      images: (item.item_images ?? []).map((i) => ({
        id: i.id,
        image_url: i.image_url,
        validation_errors: i.validation_errors,
        quality_score: i.quality_score,
      })),
    };
    const r = await this.hasura.executeMutation<{
      insert_item_ai_reviews_one: { id: string } | null;
    }>(Q.INSERT_AI_REVIEW_RUNNING, {
      itemId: item.id,
      reviewVersion: item.ai_review_version,
      promptVersion: PROMPT_VERSION,
      inputSnapshot: snapshot,
    });
    const id = r.insert_item_ai_reviews_one?.id;
    if (!id) throw new Error('Failed to create AI review row');
    return id;
  }

  private async applyDecision(
    item: ItemForAiReview,
    reviewId: string,
    result: AiReviewModelResult,
    modelMeta: Record<string, unknown>
  ): Promise<void> {
    if (result.decision === 'approve') {
      await this.applyApproveDecision(item, reviewId, result, modelMeta);
      return;
    }
    if (result.decision === 'propose') {
      await this.applyProposeDecision(item, reviewId, result, modelMeta);
      return;
    }
    await this.applyRejectDecision(item, reviewId, result, modelMeta);
  }

  private async applyApproveDecision(
    item: ItemForAiReview,
    reviewId: string,
    result: AiReviewModelResult,
    modelMeta: Record<string, unknown>
  ): Promise<void> {
    await this.activationValidation.assertItemCanActivateAsSystem(item.id);
    await this.completeReview(reviewId, 'approved', result, modelMeta);
    const applied = await this.patchItemStatusIfAiReviewing(
      item.id,
      'approved',
      true,
      'ai'
    );
    if (!applied) {
      this.logger.warn(
        `Skipped AI approve for ${item.id}; item left ai_reviewing`
      );
      return;
    }
    await this.notifications.sendSaleItemApprovedEmail({
      itemId: item.id,
      itemName: item.name,
      businessUserId: item.business.user_id,
    });
    await this.merchantLifecycleService.recompute(
      item.business_id,
      'item_ai_approved'
    );
  }

  private async applyProposeDecision(
    item: ItemForAiReview,
    reviewId: string,
    result: AiReviewModelResult,
    modelMeta: Record<string, unknown>
  ): Promise<void> {
    await this.maybeGenerateProposedImages(item, reviewId, result);
    await this.completeReview(reviewId, 'proposal', result, modelMeta);
    const applied = await this.patchItemStatusIfAiReviewing(
      item.id,
      'proposal_pending',
      false,
      'ai'
    );
    if (!applied) {
      this.logger.warn(
        `Skipped AI proposal for ${item.id}; item left ai_reviewing`
      );
      return;
    }
    await this.notifyProposal(item, result);
  }

  private async applyRejectDecision(
    item: ItemForAiReview,
    reviewId: string,
    result: AiReviewModelResult,
    modelMeta: Record<string, unknown>
  ): Promise<void> {
    await this.completeReview(reviewId, 'rejected', result, modelMeta);
    const applied = await this.patchItemStatusIfAiReviewing(
      item.id,
      'rejected',
      false,
      'ai'
    );
    if (!applied) {
      this.logger.warn(
        `Skipped AI reject for ${item.id}; item left ai_reviewing`
      );
      return;
    }
    const reason = result.reason;
    await this.insertOwnerMessage(item.business.user_id, item.id, reason);
    await this.notifications.sendSaleItemRejectedEmail({
      itemId: item.id,
      itemName: item.name,
      businessUserId: item.business.user_id,
      rejectionReason: reason,
    });
  }

  private async completeReview(
    reviewId: string,
    status: 'approved' | 'proposal' | 'rejected' | 'failed',
    result: AiReviewModelResult,
    modelMeta: Record<string, unknown>
  ): Promise<void> {
    const rejectionFields = [
      ...new Set(result.issues.map((i) => i.field).filter(Boolean)),
    ];
    await this.hasura.executeMutation(Q.COMPLETE_AI_REVIEW, {
      id: reviewId,
      status,
      decisionReason: result.reason,
      alignmentScore: result.alignmentScore ?? null,
      rubric: result.rubric ?? null,
      rawModelResponse: result,
      proposedTitle: result.proposedTitle,
      proposedDescription: result.proposedDescription,
      rejectionFields,
      modelMeta,
      completedAt: new Date().toISOString(),
    });
  }

  private async patchItemStatusIfAiReviewing(
    itemId: string,
    status: string,
    isActive: boolean,
    source: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.hasura.executeMutation<{
      update_items: { affected_rows: number };
    }>(Q.APPLY_ITEM_MODERATION_IF_AI_REVIEWING, {
      id: itemId,
      status,
      isActive,
      moderatedAt: now,
      source,
      aiReviewedAt: now,
    });
    return (result.update_items?.affected_rows ?? 0) > 0;
  }

  private async failToPendingIfAiReviewing(
    itemId: string,
    reason: string
  ): Promise<void> {
    try {
      const result = await this.hasura.executeMutation<{
        update_items: { affected_rows: number };
      }>(Q.RESET_ITEM_PENDING_IF_AI_REVIEWING, { id: itemId });
      const rows = result.update_items?.affected_rows ?? 0;
      if (rows > 0) {
        this.logger.warn(
          `AI review failed; item ${itemId} back to pending: ${reason}`
        );
      } else {
        this.logger.warn(
          `AI review failed for ${itemId} but status was no longer ai_reviewing; left unchanged (${reason})`
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to reset item ${itemId} after AI error: ${error?.message}`
      );
    }
  }

  private async insertOwnerMessage(
    userId: string,
    itemId: string,
    message: string
  ): Promise<void> {
    await this.hasura.executeMutation(Q.INSERT_OWNER_MESSAGE, {
      userId,
      itemId,
      message,
    });
  }

  private async notifyProposal(
    item: ItemForAiReview,
    result: AiReviewModelResult
  ): Promise<void> {
    const summary = [
      result.proposedTitle ? `Suggested title: ${result.proposedTitle}` : null,
      result.proposedDescription ? 'Suggested description updates' : null,
      result.imageActions.some((a) => a.action === 'cleanup')
        ? 'Suggested cleaned images'
        : null,
    ]
      .filter(Boolean)
      .join('. ');
    await this.insertOwnerMessage(
      item.business.user_id,
      item.id,
      `AI suggested improvements for your product. ${summary || result.reason}`
    );
    await this.notifications.sendSaleItemAiProposalEmail({
      itemId: item.id,
      itemName: item.name,
      businessUserId: item.business.user_id,
      proposalSummary: summary || result.reason,
    });
  }

  private async maybeGenerateProposedImages(
    item: ItemForAiReview,
    reviewId: string,
    result: AiReviewModelResult
  ): Promise<void> {
    const cleanupIds = new Set(
      result.imageActions
        .filter((a) => a.action === 'cleanup')
        .map((a) => a.imageId)
    );
    if (!cleanupIds.size) return;
    const objects: Array<Record<string, unknown>> = [];
    let order = 0;
    const maxCleanups = 2;
    let cleaned = 0;
    for (const img of item.item_images ?? []) {
      if (!cleanupIds.has(img.id) || cleaned >= maxCleanups) continue;
      const uploaded = await this.cleanupAndUpload(item, img.image_url);
      if (!uploaded) continue;
      cleaned += 1;
      objects.push({
        review_id: reviewId,
        source_image_id: img.id,
        image_url: uploaded.url,
        s3_key: uploaded.key,
        display_order: order++,
      });
    }
    if (objects.length) {
      await this.hasura.executeMutation(Q.INSERT_PROPOSED_IMAGES, { objects });
    }
  }

  private async cleanupAndUpload(
    item: ItemForAiReview,
    imageUrl: string
  ): Promise<{ url: string; key: string } | null> {
    try {
      const cleaned = await this.aiService.cleanupProductImage(imageUrl);
      const buffer = Buffer.from(cleaned.b64_json, 'base64');
      const bucket =
        this.awsService.getDefaultBucketName() ||
        process.env.S3_BUCKET_NAME ||
        'rendasua-uploads';
      const region = this.configService.get('aws')?.region || 'ca-central-1';
      const key = `businesses/${item.business_id}/item-ai-proposals/${item.id}/${Date.now()}.png`;
      await this.awsService.getS3Client().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: 'image/png',
        })
      );
      return {
        url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
        key,
      };
    } catch (error: any) {
      this.logger.warn(
        `Image cleanup skipped for item ${item.id}: ${error?.message}`
      );
      return null;
    }
  }
}
