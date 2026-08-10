import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  ReferralReviewItemMarkDto,
  ReferralReviewQueueStatus,
  SubmitBusinessReferralReviewDto,
} from './dto/business-referral-review.dto';
import * as Q from './business-referral-review.queries';

type AgentSummary = {
  id: string;
  agent_code: string | null;
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    preferred_language?: string | null;
  } | null;
};

type ReviewRow = {
  id: string;
  status: string;
  rejection_reason: string | null;
  good_item_count: number;
  bad_item_count: number;
  reviewed_at: string | null;
  reviewed_by_user_id?: string | null;
  item_marks?: Array<{ item_id: string; quality: string }>;
};

type BusinessReferrerSummary = {
  id: string;
  name: string | null;
  business_code: string | null;
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    preferred_language?: string | null;
  } | null;
};

type QueueBusinessRow = {
  id: string;
  name: string;
  created_at: string;
  referred_by_agent_id: string | null;
  referred_by_business_id?: string | null;
  items_aggregate: { aggregate: { count: number } | null };
  business_referral_reviews: ReviewRow[];
  referring_agent: AgentSummary | null;
  referring_business?: BusinessReferrerSummary | null;
};

export type ReferralReviewQueueItem = {
  businessId: string;
  businessName: string;
  createdAt: string;
  itemCount: number;
  payoutReviewStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  goodItemCount: number;
  badItemCount: number;
  reviewedAt: string | null;
  isPaid: boolean;
  referrerKind: 'agent' | 'business';
  agent: {
    agentId: string;
    agentCode: string | null;
    firstName: string;
    lastName: string;
  };
  referringBusiness: {
    businessId: string;
    businessCode: string | null;
    name: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type ReferralReviewItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | string | null;
  currency: string | null;
  status: string;
  isActive: boolean;
  moderationStatus: string;
  createdAt: string;
  updatedAt: string | null;
  qualityMark: 'good' | 'bad' | null;
  images: Array<{ id: string; imageUrl: string; displayOrder: number }>;
  inventory: Array<{
    id: string;
    quantity: number;
    locationId: string | null;
    locationName: string | null;
  }>;
};

@Injectable()
export class BusinessReferralReviewService {
  private readonly logger = new Logger(BusinessReferralReviewService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService
  ) {}

  async listQueue(params: {
    status: ReferralReviewQueueStatus;
    page: number;
    limit: number;
  }): Promise<{
    items: ReferralReviewQueueItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const limit = Math.min(Math.max(params.limit, 1), 50);
    const page = Math.max(params.page, 1);
    if (params.status === 'approved' || params.status === 'rejected') {
      return this.listByReviewStatus(params.status, page, limit);
    }
    return this.listPendingCandidates(page, limit, params.status === 'all');
  }

  async getDetail(businessId: string): Promise<{
    businessId: string;
    businessName: string;
    createdAt: string;
    isPaid: boolean;
    payoutReviewStatus: 'pending' | 'approved' | 'rejected';
    rejectionReason: string | null;
    goodItemCount: number;
    badItemCount: number;
    reviewedAt: string | null;
    referrerKind: 'agent' | 'business';
    agent: ReferralReviewQueueItem['agent'];
    referringBusiness: ReferralReviewQueueItem['referringBusiness'];
    items: ReferralReviewItem[];
  }> {
    const business = await this.fetchDetailBusiness(businessId);
    if (!this.hasReferrer(business) || !business) {
      throw new NotFoundException('Referred business not found');
    }
    const review = business.business_referral_reviews?.[0] ?? null;
    const markByItem = new Map(
      (review?.item_marks ?? []).map((m) => [m.item_id, m.quality as 'good' | 'bad'])
    );
    return {
      businessId: business.id,
      businessName: business.name,
      createdAt: business.created_at,
      isPaid: (business.business_referral_payouts?.length ?? 0) > 0,
      payoutReviewStatus: (review?.status as 'pending' | 'approved' | 'rejected') ?? 'pending',
      rejectionReason: review?.rejection_reason ?? null,
      goodItemCount: review?.good_item_count ?? 0,
      badItemCount: review?.bad_item_count ?? 0,
      reviewedAt: review?.reviewed_at ?? null,
      referrerKind: business.referred_by_business_id ? 'business' : 'agent',
      agent: this.toAgentSummary(business.referring_agent),
      referringBusiness: this.toBusinessReferrerSummary(
        business.referring_business ?? null
      ),
      items: (business.items ?? []).map((item) =>
        this.toReviewItem(item, markByItem.get(item.id) ?? null)
      ),
    };
  }

  async submit(
    businessId: string,
    moderatorUserId: string,
    dto: SubmitBusinessReferralReviewDto
  ): Promise<{ success: true; status: string }> {
    const business = await this.fetchDetailBusiness(businessId);
    this.assertCanSubmit(business);
    const marks = dto.itemMarks ?? [];
    const goodItemCount = marks.filter((m) => m.quality === 'good').length;
    const badItemCount = marks.filter((m) => m.quality === 'bad').length;
    const status = dto.decision === 'approve' ? 'approved' : 'rejected';
    const rejectionReason =
      status === 'rejected' ? (dto.rejectionReason ?? '').trim() : null;
    if (status === 'rejected' && !rejectionReason) {
      throw new HttpException('rejectionReason is required', HttpStatus.BAD_REQUEST);
    }
    const reviewId = await this.submitReviewAtomic({
      businessId,
      agentId: business!.referred_by_agent_id ?? null,
      referrerBusinessId: business!.referred_by_business_id ?? null,
      status,
      rejectionReason,
      goodItemCount,
      badItemCount,
      moderatorUserId,
      marks,
    });
    if (status === 'rejected') {
      await this.notifyRejection(business!, reviewId, rejectionReason!);
    } else {
      await this.notifyApproval(business!);
    }
    return { success: true, status };
  }

  async getReviewStatusesForBusinessIds(ids: string[]): Promise<
    Map<
      string,
      {
        payoutReviewStatus: 'pending' | 'approved' | 'rejected';
        rejectionReason: string | null;
        isPaid: boolean;
      }
    >
  > {
    const map = new Map<
      string,
      {
        payoutReviewStatus: 'pending' | 'approved' | 'rejected';
        rejectionReason: string | null;
        isPaid: boolean;
      }
    >();
    if (ids.length === 0) return map;
    const result = await this.hasuraSystemService.executeQuery<{
      business_referral_reviews: Array<{
        business_id: string;
        status: string;
        rejection_reason: string | null;
      }>;
      business_referral_payouts: Array<{ business_id: string }>;
    }>(Q.REVIEWS_FOR_BUSINESS_IDS_QUERY, { ids });
    const paid = new Set(
      (result?.business_referral_payouts ?? []).map((p) => p.business_id)
    );
    for (const id of ids) {
      map.set(id, {
        payoutReviewStatus: 'pending',
        rejectionReason: null,
        isPaid: paid.has(id),
      });
    }
    for (const row of result?.business_referral_reviews ?? []) {
      const prev = map.get(row.business_id);
      map.set(row.business_id, {
        payoutReviewStatus: row.status as 'pending' | 'approved' | 'rejected',
        rejectionReason: row.rejection_reason,
        isPaid: prev?.isPaid ?? paid.has(row.business_id),
      });
    }
    return map;
  }

  private async listPendingCandidates(
    page: number,
    limit: number,
    includeApproved: boolean
  ) {
    const offset = (page - 1) * limit;
    const result = await this.hasuraSystemService.executeQuery<{
      businesses: QueueBusinessRow[];
      businesses_aggregate: { aggregate: { count: number } | null };
    }>(Q.buildQueueCandidatesQuery(!includeApproved), {
      cutoff: Q.BUSINESS_CUTOFF_DATE,
      minItems: Q.MIN_ITEM_COUNT,
      limit,
      offset,
    });
    const rows = result?.businesses ?? [];
    const total = result?.businesses_aggregate?.aggregate?.count ?? rows.length;
    return this.toQueueResult(rows, page, limit, total, true);
  }

  private async listByReviewStatus(
    status: 'approved' | 'rejected',
    page: number,
    limit: number
  ) {
    const offset = (page - 1) * limit;
    const result = await this.hasuraSystemService.executeQuery<{
      business_referral_reviews: Array<{
        id: string;
        status: string;
        rejection_reason: string | null;
        good_item_count: number;
        bad_item_count: number;
        reviewed_at: string | null;
        business: {
          id: string;
          name: string;
          created_at: string;
          items_aggregate: { aggregate: { count: number } | null };
          business_referral_payouts: Array<{ id: string }>;
        };
        agent: AgentSummary;
      }>;
      business_referral_reviews_aggregate: {
        aggregate: { count: number } | null;
      };
    }>(Q.REVIEWS_BY_STATUS_QUERY, { status, limit, offset });
    const items = (result?.business_referral_reviews ?? []).map((row) =>
      this.fromStatusRow(row)
    );
    const total =
      result?.business_referral_reviews_aggregate?.aggregate?.count ?? 0;
    return this.paginate(items, page, limit, total);
  }

  private toQueueResult(
    rows: QueueBusinessRow[],
    page: number,
    limit: number,
    total: number,
    unpaid: boolean
  ) {
    const items = rows.map((row) => this.fromQueueRow(row, unpaid));
    return this.paginate(items, page, limit, total);
  }

  private paginate(
    items: ReferralReviewQueueItem[],
    page: number,
    limit: number,
    total: number
  ) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  private fromQueueRow(
    row: QueueBusinessRow,
    unpaid: boolean
  ): ReferralReviewQueueItem {
    const review = row.business_referral_reviews?.[0];
    return {
      businessId: row.id,
      businessName: row.name,
      createdAt: row.created_at,
      itemCount: row.items_aggregate?.aggregate?.count ?? 0,
      payoutReviewStatus:
        (review?.status as 'pending' | 'approved' | 'rejected') ?? 'pending',
      rejectionReason: review?.rejection_reason ?? null,
      goodItemCount: review?.good_item_count ?? 0,
      badItemCount: review?.bad_item_count ?? 0,
      reviewedAt: review?.reviewed_at ?? null,
      isPaid: !unpaid,
      referrerKind: row.referred_by_business_id ? 'business' : 'agent',
      agent: this.toAgentSummary(row.referring_agent),
      referringBusiness: this.toBusinessReferrerSummary(
        row.referring_business ?? null
      ),
    };
  }

  private fromStatusRow(row: {
    status: string;
    rejection_reason: string | null;
    good_item_count: number;
    bad_item_count: number;
    reviewed_at: string | null;
    business: {
      id: string;
      name: string;
      created_at: string;
      items_aggregate: { aggregate: { count: number } | null };
      business_referral_payouts: Array<{ id: string }>;
    };
    agent: AgentSummary | null;
    referrer_business?: BusinessReferrerSummary | null;
  }): ReferralReviewQueueItem {
    return {
      businessId: row.business.id,
      businessName: row.business.name,
      createdAt: row.business.created_at,
      itemCount: row.business.items_aggregate?.aggregate?.count ?? 0,
      payoutReviewStatus: row.status as 'pending' | 'approved' | 'rejected',
      rejectionReason: row.rejection_reason,
      goodItemCount: row.good_item_count,
      badItemCount: row.bad_item_count,
      reviewedAt: row.reviewed_at,
      isPaid: (row.business.business_referral_payouts?.length ?? 0) > 0,
      referrerKind: row.referrer_business ? 'business' : 'agent',
      agent: this.toAgentSummary(row.agent),
      referringBusiness: this.toBusinessReferrerSummary(
        row.referrer_business ?? null
      ),
    };
  }

  private toAgentSummary(agent: AgentSummary | null): ReferralReviewQueueItem['agent'] {
    return {
      agentId: agent?.id ?? '',
      agentCode: agent?.agent_code ?? null,
      firstName: agent?.user?.first_name ?? '',
      lastName: agent?.user?.last_name ?? '',
    };
  }

  private toBusinessReferrerSummary(
    business: BusinessReferrerSummary | null
  ): ReferralReviewQueueItem['referringBusiness'] {
    if (!business) return null;
    return {
      businessId: business.id,
      businessCode: business.business_code,
      name: business.name ?? '',
      firstName: business.user?.first_name ?? '',
      lastName: business.user?.last_name ?? '',
    };
  }

  private async fetchDetailBusiness(businessId: string) {
    const result = await this.hasuraSystemService.executeQuery<{
      businesses_by_pk: {
        id: string;
        name: string;
        created_at: string;
        referred_by_agent_id: string | null;
        referred_by_business_id: string | null;
        referring_agent: AgentSummary | null;
        referring_business: BusinessReferrerSummary | null;
        business_referral_payouts: Array<{ id: string }>;
        business_referral_reviews: ReviewRow[];
        items: Array<{
          id: string;
          name: string;
          description: string | null;
          price: number | string | null;
          currency: string | null;
          status: string;
          is_active: boolean;
          moderation_status: string;
          created_at: string;
          updated_at: string | null;
          item_images: Array<{
            id: string;
            image_url: string;
            display_order: number;
          }>;
          business_inventories: Array<{
            id: string;
            quantity: number;
            business_location: { id: string; name: string } | null;
          }>;
        }>;
      } | null;
    }>(Q.REVIEW_DETAIL_QUERY, { businessId });
    return result?.businesses_by_pk ?? null;
  }

  private hasReferrer(
    business: Awaited<ReturnType<typeof this.fetchDetailBusiness>>
  ): boolean {
    if (!business) return false;
    if (business.referred_by_agent_id && business.referring_agent) return true;
    if (business.referred_by_business_id && business.referring_business) {
      return true;
    }
    return false;
  }

  private assertCanSubmit(
    business: Awaited<ReturnType<typeof this.fetchDetailBusiness>>
  ): void {
    if (!this.hasReferrer(business)) {
      throw new NotFoundException('Referred business not found');
    }
    if ((business!.business_referral_payouts?.length ?? 0) > 0) {
      throw new ConflictException('Referral already paid; review is locked');
    }
  }

  private async submitReviewAtomic(params: {
    businessId: string;
    agentId: string | null;
    referrerBusinessId: string | null;
    status: string;
    rejectionReason: string | null;
    goodItemCount: number;
    badItemCount: number;
    moderatorUserId: string;
    marks: ReferralReviewItemMarkDto[];
  }): Promise<string> {
    const reviewedAt = new Date().toISOString();
    const object: Record<string, unknown> = {
      business_id: params.businessId,
      agent_id: params.agentId,
      referrer_business_id: params.referrerBusinessId,
      status: params.status,
      rejection_reason: params.rejectionReason,
      good_item_count: params.goodItemCount,
      bad_item_count: params.badItemCount,
      reviewed_by_user_id: params.moderatorUserId,
      reviewed_at: reviewedAt,
    };
    if (params.marks.length > 0) {
      object.item_marks = {
        data: params.marks.map((m) => ({
          item_id: m.itemId,
          quality: m.quality,
        })),
      };
    }
    const result = await this.hasuraSystemService.executeMutation<{
      insert_business_referral_reviews_one: { id: string; status: string } | null;
    }>(Q.SUBMIT_REVIEW_MUTATION, {
      businessId: params.businessId,
      object,
    });
    const id = result?.insert_business_referral_reviews_one?.id;
    if (!id) {
      throw new HttpException('Failed to save review', HttpStatus.BAD_REQUEST);
    }
    return id;
  }

  private resolveReferrerUser(
    business: NonNullable<Awaited<ReturnType<typeof this.fetchDetailBusiness>>>
  ): { userId: string; preferredLanguage: string } | null {
    const agentUser = business.referring_agent?.user;
    if (agentUser?.id) {
      return {
        userId: agentUser.id,
        preferredLanguage: agentUser.preferred_language ?? 'en',
      };
    }
    const businessUser = business.referring_business?.user;
    if (businessUser?.id) {
      return {
        userId: businessUser.id,
        preferredLanguage: businessUser.preferred_language ?? 'en',
      };
    }
    return null;
  }

  private async notifyRejection(
    business: NonNullable<Awaited<ReturnType<typeof this.fetchDetailBusiness>>>,
    reviewId: string,
    reason: string
  ): Promise<void> {
    const referrer = this.resolveReferrerUser(business);
    if (!referrer) return;
    const isFr = referrer.preferredLanguage.toLowerCase().startsWith('fr');
    const title = isFr ? 'Parrainage refusé' : 'Referral payout rejected';
    const body = isFr
      ? `Parrainage de ${business.name} refusé : ${reason}`
      : `Referral for ${business.name} was rejected: ${reason}`;
    try {
      await this.hasuraSystemService.executeMutation(Q.INSERT_REJECTION_MESSAGE, {
        userId: referrer.userId,
        reviewId,
        message: body,
        payload: {
          business_id: business.id,
          business_name: business.name,
          rejection_reason: reason,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Failed to insert rejection message: ${error.message}`);
    }
    try {
      await this.notificationsService.sendInternalPushByUserId(
        referrer.userId,
        title,
        body,
        {
          event: 'business_referral_review_rejected',
          businessId: business.id,
          businessName: business.name,
          rejectionReason: reason,
          reviewId,
        }
      );
    } catch (error: any) {
      this.logger.warn(
        `Rejection push failed for ${referrer.userId}: ${error.message}`
      );
    }
  }

  private async notifyApproval(
    business: NonNullable<Awaited<ReturnType<typeof this.fetchDetailBusiness>>>
  ): Promise<void> {
    const referrer = this.resolveReferrerUser(business);
    if (!referrer) return;
    const isFr = referrer.preferredLanguage.toLowerCase().startsWith('fr');
    const title = isFr ? 'Parrainage approuvé' : 'Referral approved';
    const body = isFr
      ? `Parrainage de ${business.name} approuvé — crédit au prochain cycle.`
      : `Referral for ${business.name} approved — credit on next payout cycle.`;
    try {
      await this.notificationsService.sendInternalPushByUserId(
        referrer.userId,
        title,
        body,
        {
          event: 'business_referral_review_approved',
          businessId: business.id,
          businessName: business.name,
          url: '/accounts',
        }
      );
    } catch (error: any) {
      this.logger.warn(
        `Approval push failed for ${referrer.userId}: ${error.message}`
      );
    }
  }

  private toReviewItem(
    item: {
      id: string;
      name: string;
      description: string | null;
      price: number | string | null;
      currency: string | null;
      status: string;
      is_active: boolean;
      moderation_status: string;
      created_at: string;
      updated_at: string | null;
      item_images: Array<{
        id: string;
        image_url: string;
        display_order: number;
      }>;
      business_inventories: Array<{
        id: string;
        quantity: number;
        business_location: { id: string; name: string } | null;
      }>;
    },
    qualityMark: 'good' | 'bad' | null
  ): ReferralReviewItem {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      currency: item.currency,
      status: item.status,
      isActive: item.is_active,
      moderationStatus: item.moderation_status,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      qualityMark,
      images: (item.item_images ?? []).map((img) => ({
        id: img.id,
        imageUrl: img.image_url,
        displayOrder: img.display_order,
      })),
      inventory: (item.business_inventories ?? []).map((inv) => ({
        id: inv.id,
        quantity: inv.quantity,
        locationId: inv.business_location?.id ?? null,
        locationName: inv.business_location?.name ?? null,
      })),
    };
  }
}
