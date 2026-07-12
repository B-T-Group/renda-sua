import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { ItemActivationValidationService } from '../image-validation/item-activation-validation.service';
import { isActivePersona } from '../users/persona.util';
import { RentalListingAiReviewService } from './rental-listing-ai-review.service';
import * as Q from './rental-listing-ai-review.queries';
import { AcceptAiProposalDto } from './dto/rental-listing-ai-review.dto';

@Injectable()
export class RentalListingAiProposalService {
  constructor(
    private readonly hasuraSystem: HasuraSystemService,
    private readonly hasuraUser: HasuraUserService,
    private readonly reviewService: RentalListingAiReviewService,
    private readonly activationValidation: ItemActivationValidationService
  ) {}

  async getProposal(listingId: string) {
    await this.assertBusinessOwnsListing(listingId);
    const data = await this.loadProposal(listingId);
    const review = data.rental_listing_ai_reviews?.[0] ?? null;
    return {
      listing: data.rental_location_listings_by_pk,
      proposal: review,
    };
  }

  async acceptProposal(listingId: string, dto: AcceptAiProposalDto) {
    const businessId = await this.requireBusinessId();
    const data = await this.loadProposal(listingId);
    const listing = data.rental_location_listings_by_pk;
    this.assertProposalPending(listing);
    this.assertOwned(listing, businessId);
    const review = data.rental_listing_ai_reviews?.[0];
    if (!review) {
      throw new HttpException('No AI proposal found', HttpStatus.NOT_FOUND);
    }
    await this.applyAcceptedCopy(listing.rental_item.id, review, dto);
    await this.applyProposedImages(listing, review);
    await this.activationValidation.assertRentalItemCanActivateAsSystem(
      listing.rental_item.id
    );
    await this.markApproved(listingId);
    return { success: true };
  }

  async declineProposal(listingId: string) {
    const businessId = await this.requireBusinessId();
    const data = await this.loadProposal(listingId);
    const listing = data.rental_location_listings_by_pk;
    this.assertProposalPending(listing);
    this.assertOwned(listing, businessId);
    await this.hasuraSystem.executeMutation(Q.RESET_LISTING_PENDING, {
      id: listingId,
    });
    await this.reviewService.requestReview(listingId);
    return { success: true };
  }

  private async loadProposal(listingId: string) {
    return this.hasuraSystem.executeQuery<{
      rental_location_listings_by_pk: any | null;
      rental_listing_ai_reviews: any[];
    }>(Q.GET_AI_PROPOSAL_FOR_LISTING, { listingId });
  }

  private assertProposalPending(listing: any): void {
    if (!listing) {
      throw new HttpException('Listing not found', HttpStatus.NOT_FOUND);
    }
    if (listing.moderation_status !== 'proposal_pending') {
      throw new HttpException(
        'Listing does not have a pending AI proposal',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private assertOwned(listing: any, businessId: string): void {
    if (listing.rental_item?.business_id !== businessId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  private async assertBusinessOwnsListing(listingId: string): Promise<void> {
    const businessId = await this.requireBusinessId();
    const data = await this.loadProposal(listingId);
    if (!data.rental_location_listings_by_pk) {
      throw new HttpException('Listing not found', HttpStatus.NOT_FOUND);
    }
    this.assertOwned(data.rental_location_listings_by_pk, businessId);
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
    await this.hasuraSystem.executeMutation(Q.UPDATE_RENTAL_ITEM_COPY, {
      id: itemId,
      _set,
    });
  }

  private async applyProposedImages(listing: any, review: any): Promise<void> {
    const images = review.proposed_images ?? [];
    if (!images.length) return;
    let order =
      (listing.rental_item.rental_item_images?.length ?? 0) + 1;
    for (const img of images) {
      await this.hasuraSystem.executeMutation(Q.INSERT_RENTAL_ITEM_IMAGE, {
        object: {
          business_id: listing.rental_item.business_id,
          rental_item_id: listing.rental_item.id,
          image_url: img.image_url,
          s3_key: img.s3_key,
          display_order: order++,
          status: 'assigned',
          is_ai_cleaned: true,
        },
      });
    }
  }

  private async markApproved(listingId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.hasuraSystem.executeMutation(Q.APPLY_LISTING_MODERATION, {
      id: listingId,
      status: 'approved',
      moderatedAt: now,
      moderatorId: null,
      source: 'business_accept',
      aiReviewedAt: now,
    });
  }
}
