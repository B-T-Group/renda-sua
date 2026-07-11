import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { ItemActivationValidationService } from '../image-validation/item-activation-validation.service';
import { isActivePersona } from '../users/persona.util';
import { ItemAiReviewService } from './item-ai-review.service';
import * as Q from './item-ai-review.queries';
import { AcceptAiProposalDto } from './dto/item-ai-review.dto';

@Injectable()
export class ItemAiProposalService {
  constructor(
    private readonly hasuraSystem: HasuraSystemService,
    private readonly hasuraUser: HasuraUserService,
    private readonly reviewService: ItemAiReviewService,
    private readonly activationValidation: ItemActivationValidationService
  ) {}

  async getProposal(itemId: string) {
    await this.assertBusinessOwnsItem(itemId);
    const data = await this.loadProposal(itemId);
    const review = data.item_ai_reviews?.[0] ?? null;
    return {
      item: data.items_by_pk,
      proposal: review,
    };
  }

  async acceptProposal(itemId: string, dto: AcceptAiProposalDto) {
    const businessId = await this.requireBusinessId();
    const data = await this.loadProposal(itemId);
    const item = data.items_by_pk;
    this.assertProposalPending(item);
    this.assertOwned(item, businessId);
    const review = data.item_ai_reviews?.[0];
    if (!review) {
      throw new HttpException('No AI proposal found', HttpStatus.NOT_FOUND);
    }
    await this.applyAcceptedCopy(item.id, review, dto);
    await this.applyProposedImages(item, review);
    await this.activationValidation.assertItemCanActivateAsSystem(itemId);
    await this.markApproved(itemId);
    return { success: true };
  }

  async declineProposal(itemId: string) {
    const businessId = await this.requireBusinessId();
    const data = await this.loadProposal(itemId);
    const item = data.items_by_pk;
    this.assertProposalPending(item);
    this.assertOwned(item, businessId);
    await this.hasuraSystem.executeMutation(Q.RESET_ITEM_PENDING, {
      id: itemId,
    });
    await this.reviewService.requestReview(itemId);
    return { success: true };
  }

  private async loadProposal(itemId: string) {
    return this.hasuraSystem.executeQuery<{
      items_by_pk: any | null;
      item_ai_reviews: any[];
    }>(Q.GET_AI_PROPOSAL_FOR_ITEM, { itemId });
  }

  private assertProposalPending(item: any): void {
    if (!item) {
      throw new HttpException('Item not found', HttpStatus.NOT_FOUND);
    }
    if (item.moderation_status !== 'proposal_pending') {
      throw new HttpException(
        'Item does not have a pending AI proposal',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private assertOwned(item: any, businessId: string): void {
    if (item.business_id !== businessId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  private async assertBusinessOwnsItem(itemId: string): Promise<void> {
    const businessId = await this.requireBusinessId();
    const data = await this.loadProposal(itemId);
    if (!data.items_by_pk) {
      throw new HttpException('Item not found', HttpStatus.NOT_FOUND);
    }
    this.assertOwned(data.items_by_pk, businessId);
  }

  private async requireBusinessId(): Promise<string> {
    const user = await this.hasuraUser.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException('Business profile required', HttpStatus.FORBIDDEN);
    }
    return user.business.id;
  }

  private async applyAcceptedCopy(
    itemId: string,
    review: any,
    dto: AcceptAiProposalDto
  ): Promise<void> {
    const name = (dto.title ?? review.proposed_title)?.trim();
    const description = (
      dto.description ?? review.proposed_description
    )?.trim();
    const _set: Record<string, string> = {};
    if (name) _set.name = name;
    if (description != null && description !== '') {
      _set.description = description;
    }
    if (!Object.keys(_set).length) return;
    await this.hasuraSystem.executeMutation(Q.UPDATE_ITEM_COPY, {
      id: itemId,
      _set,
    });
  }

  private async applyProposedImages(item: any, review: any): Promise<void> {
    const images = review.proposed_images ?? [];
    if (!images.length) return;
    let order = (item.item_images?.length ?? 0) + 1;
    for (const img of images) {
      await this.hasuraSystem.executeMutation(Q.INSERT_ITEM_IMAGE, {
        object: {
          business_id: item.business_id,
          item_id: item.id,
          image_url: img.image_url,
          s3_key: img.s3_key,
          display_order: order++,
          status: 'assigned',
          is_ai_cleaned: true,
        },
      });
    }
  }

  private async markApproved(itemId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.hasuraSystem.executeMutation(Q.APPLY_ITEM_MODERATION, {
      id: itemId,
      status: 'approved',
      isActive: true,
      moderatedAt: now,
      moderatorId: null,
      source: 'business_accept',
      aiReviewedAt: now,
    });
  }
}
