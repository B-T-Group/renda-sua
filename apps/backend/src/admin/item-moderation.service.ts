import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ItemActivationValidationService } from '../image-validation/item-activation-validation.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as Q from './item-moderation.queries';

type ModerationStatusFilter =
  | 'pending'
  | 'rejected'
  | 'ai_reviewing'
  | 'proposal_pending'
  | 'all';

export interface ItemModerationRow {
  id: string;
  name: string;
  description: string | null;
  moderation_status: string;
  created_at: string;
  price: number | string | null;
  currency: string | null;
  is_active: boolean;
  business: { id: string; name: string; user_id: string };
}

type ItemForModerationRow = {
  id: string;
  name: string;
  moderation_status: string;
  status: string;
  business: { id: string; user_id: string };
};

const HUMAN_REVIEWABLE = new Set(['pending', 'ai_reviewing']);

@Injectable()
export class ItemModerationService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService,
    private readonly activationValidation: ItemActivationValidationService,
    private readonly merchantLifecycleService: MerchantLifecycleService
  ) {}

  async listModerationQueue(params: {
    status?: string;
    page: number;
    limit: number;
  }): Promise<{
    items: ItemModerationRow[];
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
    const offset = (page - 1) * limit;
    const where = this.buildModerationWhere(
      this.parseModerationStatusFilter(params.status)
    );
    const result = await this.hasuraSystemService.executeQuery<{
      items: ItemModerationRow[];
      items_aggregate: { aggregate: { count: number } | null };
    }>(Q.ITEMS_MODERATION_LIST, { where, limit, offset });
    return this.toModerationListResult(result, page, limit);
  }

  async approveItem(itemId: string, moderatorUserId: string): Promise<void> {
    const item = await this.fetchItemForModeration(itemId);
    this.assertPendingModeration(item.moderation_status, 'approved');
    await this.activationValidation.assertItemCanActivateAsSystem(itemId);
    await this.runModerationPatch(
      itemId,
      moderatorUserId,
      Q.APPROVE_ITEM_MODERATION
    );
    await this.notificationsService.sendSaleItemApprovedEmail({
      itemId,
      businessUserId: item.business.user_id,
      itemName: item.name,
    });
    await this.merchantLifecycleService.recompute(
      item.business.id,
      'item_approved'
    );
  }

  async rejectItem(
    itemId: string,
    moderatorUserId: string,
    rejectionReason: string
  ): Promise<void> {
    const item = await this.fetchItemForModeration(itemId);
    this.assertPendingModeration(item.moderation_status, 'rejected');
    const ownerUserId = item.business.user_id;
    const trimmed = rejectionReason.trim();
    await this.runModerationPatch(
      itemId,
      moderatorUserId,
      Q.REJECT_ITEM_MODERATION
    );
    await this.insertOwnerMessage(ownerUserId, itemId, trimmed);
    await this.notificationsService.sendSaleItemRejectedEmail({
      itemId,
      businessUserId: ownerUserId,
      itemName: item.name,
      rejectionReason: trimmed,
    });
  }

  private toModerationListResult(
    result: {
      items: ItemModerationRow[];
      items_aggregate: { aggregate: { count: number } | null };
    },
    page: number,
    limit: number
  ) {
    const items = result.items ?? [];
    const total = result.items_aggregate?.aggregate?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;
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

  private parseModerationStatusFilter(raw?: string): ModerationStatusFilter {
    const s = (raw || 'pending').toLowerCase();
    if (s === 'rejected') return 'rejected';
    if (s === 'ai_reviewing') return 'ai_reviewing';
    if (s === 'proposal_pending') return 'proposal_pending';
    if (s === 'all') return 'all';
    return 'pending';
  }

  private buildModerationWhere(
    status: ModerationStatusFilter
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      status: { _eq: 'active' },
    };
    if (status === 'all') {
      return {
        _and: [
          base,
          {
            moderation_status: {
              _in: [
                'pending',
                'rejected',
                'ai_reviewing',
                'proposal_pending',
              ],
            },
          },
        ],
      };
    }
    return {
      _and: [base, { moderation_status: { _eq: status } }],
    };
  }

  private assertPendingModeration(
    status: string,
    action: 'approved' | 'rejected'
  ): void {
    if (HUMAN_REVIEWABLE.has(status)) return;
    const verb = action === 'approved' ? 'approved' : 'rejected';
    throw new HttpException(
      `Only items pending or in AI review can be ${verb}`,
      HttpStatus.BAD_REQUEST
    );
  }

  private async fetchItemForModeration(
    itemId: string
  ): Promise<ItemForModerationRow> {
    const r = await this.hasuraSystemService.executeQuery<{
      items_by_pk: ItemForModerationRow | null;
    }>(Q.ITEM_FOR_MODERATION_BY_PK, { id: itemId });
    const row = r.items_by_pk;
    if (!row || row.status !== 'active') {
      throw new HttpException('Item not found', HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async runModerationPatch(
    itemId: string,
    moderatorUserId: string,
    mutation: string
  ): Promise<void> {
    const moderatedAt = new Date().toISOString();
    const result = await this.hasuraSystemService.executeMutation<{
      update_items_by_pk: { id: string } | null;
    }>(mutation, {
      id: itemId,
      moderatedAt,
      moderatorId: moderatorUserId,
    });
    if (!result.update_items_by_pk) {
      throw new HttpException('Update failed', HttpStatus.BAD_REQUEST);
    }
  }

  private async insertOwnerMessage(
    ownerUserId: string,
    itemId: string,
    message: string
  ): Promise<void> {
    const result = await this.hasuraSystemService.executeMutation<{
      insert_user_messages_one: { id: string } | null;
    }>(Q.INSERT_ITEM_REJECTION_MESSAGE, {
      userId: ownerUserId,
      itemId,
      message,
    });
    if (!result.insert_user_messages_one) {
      throw new HttpException(
        'Failed to record rejection message',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
