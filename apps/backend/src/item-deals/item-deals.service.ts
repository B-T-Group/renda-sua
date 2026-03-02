import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DiscountType } from '../business-items/dto/create-item-deal.dto';

export interface ItemDeal {
  id: string;
  inventory_item_id: string;
  discount_type: DiscountType;
  discount_value: number;
  start_at: string;
  end_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const GET_BUSINESS_INVENTORY_FOR_DEAL = `
  query GetBusinessInventoryForDeal($id: uuid!) {
    business_inventory_by_pk(id: $id) {
      id
      business_location {
        business_id
      }
    }
  }
`;

const GET_ITEM_DEALS = `
  query GetItemDeals($inventoryItemId: uuid!) {
    item_deals(
      where: { inventory_item_id: { _eq: $inventoryItemId } }
      order_by: { start_at: desc }
    ) {
      id
      inventory_item_id
      discount_type
      discount_value
      start_at
      end_at
      is_active
      created_at
      updated_at
    }
  }
`;

const GET_OVERLAPPING_DEALS = `
  query GetOverlappingDeals(
    $inventoryItemId: uuid!
    $startAt: timestamptz!
    $endAt: timestamptz!
    $excludeId: uuid
  ) {
    item_deals(
      where: {
        inventory_item_id: { _eq: $inventoryItemId }
        is_active: { _eq: true }
        start_at: { _lte: $endAt }
        end_at: { _gte: $startAt }
        _and: [
          { id: { _neq: $excludeId } }
        ]
      }
    ) {
      id
    }
  }
`;

const INSERT_ITEM_DEAL = `
  mutation InsertItemDeal($object: item_deals_insert_input!) {
    insert_item_deals_one(object: $object) {
      id
      inventory_item_id
      discount_type
      discount_value
      start_at
      end_at
      is_active
      created_at
      updated_at
    }
  }
`;

const UPDATE_ITEM_DEAL = `
  mutation UpdateItemDeal($id: uuid!, $set: item_deals_set_input!) {
    update_item_deals_by_pk(pk_columns: { id: $id }, _set: $set) {
      id
      inventory_item_id
      discount_type
      discount_value
      start_at
      end_at
      is_active
      created_at
      updated_at
    }
  }
`;

const DELETE_ITEM_DEAL = `
  mutation DeleteItemDeal($id: uuid!) {
    delete_item_deals_by_pk(id: $id) {
      id
    }
  }
`;

@Injectable()
export class ItemDealsService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getDealsForInventory(
    businessId: string,
    inventoryItemId: string
  ): Promise<ItemDeal[]> {
    await this.assertInventoryBelongsToBusiness(inventoryItemId, businessId);
    const result = await this.hasuraSystemService.executeQuery(GET_ITEM_DEALS, {
      inventoryItemId,
    });
    return (result.item_deals as ItemDeal[]) ?? [];
  }

  async createDeal(params: {
    businessId: string;
    inventoryItemId: string;
    discountType: DiscountType;
    discountValue: number;
    startAt: string;
    endAt: string;
  }): Promise<ItemDeal> {
    const { businessId, inventoryItemId, discountType, discountValue, startAt, endAt } =
      params;

    await this.assertInventoryBelongsToBusiness(inventoryItemId, businessId);

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (!(start.getTime() < end.getTime())) {
      throw new HttpException(
        {
          success: false,
          error: 'Start time must be before end time',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const overlap = await this.hasuraSystemService.executeQuery(
      GET_OVERLAPPING_DEALS,
      {
        inventoryItemId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        excludeId: null,
      }
    );

    if ((overlap.item_deals as { id: string }[])?.length) {
      throw new HttpException(
        {
          success: false,
          error: 'A deal already exists for this item in the selected period',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const variables = {
      object: {
        inventory_item_id: inventoryItemId,
        discount_type: discountType,
        discount_value: discountValue,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        is_active: true,
      },
    };

    const result = await this.hasuraSystemService.executeMutation(
      INSERT_ITEM_DEAL,
      variables
    );

    return result.insert_item_deals_one as ItemDeal;
  }

  async updateDeal(params: {
    businessId: string;
    dealId: string;
    updates: {
      discountType?: DiscountType;
      discountValue?: number;
      startAt?: string;
      endAt?: string;
      isActive?: boolean;
    };
  }): Promise<ItemDeal> {
    const { businessId, dealId, updates } = params;

    const existing = await this.hasuraSystemService.executeQuery(
      `
      query GetDealWithInventory($id: uuid!) {
        item_deals_by_pk(id: $id) {
          id
          inventory_item_id
          discount_type
          discount_value
          start_at
          end_at
          is_active
        }
      }
    `,
      { id: dealId }
    );

    const deal = existing.item_deals_by_pk as ItemDeal | null;
    if (!deal) {
      throw new HttpException(
        { success: false, error: 'Deal not found' },
        HttpStatus.NOT_FOUND
      );
    }

    await this.assertInventoryBelongsToBusiness(
      deal.inventory_item_id,
      businessId
    );

    const startAt = updates.startAt ?? deal.start_at;
    const endAt = updates.endAt ?? deal.end_at;
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (!(start.getTime() < end.getTime())) {
      throw new HttpException(
        {
          success: false,
          error: 'Start time must be before end time',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const overlap = await this.hasuraSystemService.executeQuery(
      GET_OVERLAPPING_DEALS,
      {
        inventoryItemId: deal.inventory_item_id,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        excludeId: dealId,
      }
    );

    if ((overlap.item_deals as { id: string }[])?.length) {
      throw new HttpException(
        {
          success: false,
          error: 'A deal already exists for this item in the selected period',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const set: Record<string, unknown> = {};
    if (updates.discountType !== undefined) {
      set.discount_type = updates.discountType;
    }
    if (updates.discountValue !== undefined) {
      set.discount_value = updates.discountValue;
    }
    if (updates.startAt !== undefined) {
      set.start_at = start.toISOString();
    }
    if (updates.endAt !== undefined) {
      set.end_at = end.toISOString();
    }
    if (updates.isActive !== undefined) {
      set.is_active = updates.isActive;
    }

    const result = await this.hasuraSystemService.executeMutation(
      UPDATE_ITEM_DEAL,
      {
        id: dealId,
        set,
      }
    );

    return result.update_item_deals_by_pk as ItemDeal;
  }

  async deleteDeal(businessId: string, dealId: string): Promise<void> {
    const existing = await this.hasuraSystemService.executeQuery(
      `
      query GetDealWithInventory($id: uuid!) {
        item_deals_by_pk(id: $id) {
          id
          inventory_item_id
        }
      }
    `,
      { id: dealId }
    );

    const deal = existing.item_deals_by_pk as { id: string; inventory_item_id: string } | null;
    if (!deal) {
      throw new HttpException(
        { success: false, error: 'Deal not found' },
        HttpStatus.NOT_FOUND
      );
    }

    await this.assertInventoryBelongsToBusiness(
      deal.inventory_item_id,
      businessId
    );

    await this.hasuraSystemService.executeMutation(DELETE_ITEM_DEAL, {
      id: dealId,
    });
  }

  private async assertInventoryBelongsToBusiness(
    inventoryItemId: string,
    businessId: string
  ): Promise<void> {
    const result = await this.hasuraSystemService.executeQuery(
      GET_BUSINESS_INVENTORY_FOR_DEAL,
      { id: inventoryItemId }
    );

    const inv = result.business_inventory_by_pk as {
      id: string;
      business_location?: { business_id: string | null } | null;
    } | null;

    if (!inv || inv.business_location?.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Inventory item not found for this business' },
        HttpStatus.FORBIDDEN
      );
    }
  }
}

