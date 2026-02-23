import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { CsvItemRowDto, CsvUploadResultDto } from './dto/csv-upload.dto';

const GET_ITEMS = `
  query GetItems($businessId: uuid!) {
    items(
      where: { business_id: { _eq: $businessId }, status: { _eq: active } }
      order_by: { name: asc }
    ) {
      id
      name
      description
      item_sub_category_id
      weight
      weight_unit
      dimensions
      price
      currency
      sku
      brand_id
      model
      color
      is_fragile
      is_perishable
      requires_special_handling
      max_delivery_distance
      estimated_delivery_time
      min_order_quantity
      max_order_quantity
      is_active
      business_id
      created_at
      updated_at
      brand {
        id
        name
        description
      }
      item_sub_category {
        id
        name
        item_category {
          id
          name
        }
      }
      item_images {
        id
        image_url
        image_type
        alt_text
        display_order
        created_at
      }
      business_inventories {
        id
        item_id
        business_location_id
        quantity
        computed_available_quantity
        reserved_quantity
        selling_price
        unit_cost
        reorder_point
        reorder_quantity
        is_active
        created_at
        updated_at
        business_location {
          id
          name
          address_id
        }
      }
    }
  }
`;

const GET_BUSINESS_LOCATIONS = `
  query GetBusinessLocations($businessId: uuid!) {
    business_locations(
      where: { business_id: { _eq: $businessId } }
      order_by: { name: asc }
    ) {
      id
      name
      location_type
      is_primary
      created_at
      updated_at
      address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
      }
    }
  }
`;

const GET_AVAILABLE_ITEMS = `
  query GetAvailableItems {
    items(
      where: { 
        is_active: { _eq: true },
        status: { _eq: active },
        business: { is_verified: { _eq: true } }
      }
      order_by: { name: asc }
    ) {
      id
      name
      description
      price
      currency
      weight
      weight_unit
      sku
      brand {
        id
        name
        description
      }
      model
      color
      is_fragile
      is_perishable
      requires_special_handling
      max_delivery_distance
      estimated_delivery_time
      min_order_quantity
      max_order_quantity
      is_active
      business {
        id
        name
        is_verified
      }
    }
  }
`;

const GET_BUSINESS_INVENTORY = `
  query GetBusinessInventory($businessId: uuid!) {
    business_inventory(
      where: { business_location: { business_id: { _eq: $businessId } } }
      order_by: { created_at: desc }
    ) {
      id
      business_location_id
      item_id
      quantity
      computed_available_quantity
      reserved_quantity
      reorder_point
      reorder_quantity
      unit_cost
      selling_price
      is_active
      created_at
      updated_at
      business_location {
        id
        name
      }
      item {
        id
        name
        sku
      }
    }
  }
`;

const INSERT_ITEM = `
  mutation CreateItem($itemData: items_insert_input!) {
    insert_items_one(object: $itemData) {
      id
      name
      sku
    }
  }
`;

const UPDATE_ITEM = `
  mutation UpdateItem($id: uuid!, $itemData: items_set_input!) {
    update_items_by_pk(pk_columns: { id: $id }, _set: $itemData) {
      id
      name
      sku
    }
  }
`;

const INSERT_BUSINESS_INVENTORY = `
  mutation AddInventoryItem($itemData: business_inventory_insert_input!) {
    insert_business_inventory_one(object: $itemData) {
      id
      item_id
      business_location_id
    }
  }
`;

const UPDATE_BUSINESS_INVENTORY = `
  mutation UpdateInventoryItem($itemId: uuid!, $updates: business_inventory_set_input!) {
    update_business_inventory_by_pk(pk_columns: { id: $itemId }, _set: $updates) {
      id
      item_id
      business_location_id
    }
  }
`;

const GET_ITEM_SUB_CATEGORY_IDS = `
  query GetItemSubCategoryIds {
    item_sub_categories {
      id
    }
  }
`;

const GET_ITEM_IMAGES = `
  query GetItemImages($itemId: uuid!) {
    item_images(where: { item_id: { _eq: $itemId } }, order_by: { display_order: asc }) {
      id
      image_type
    }
  }
`;

const DELETE_ITEM_IMAGE = `
  mutation DeleteItemImage($id: uuid!) {
    delete_item_images_by_pk(id: $id) {
      id
    }
  }
`;

const INSERT_ITEM_IMAGE = `
  mutation CreateItemImage($imageData: item_images_insert_input!) {
    insert_item_images_one(object: $imageData) {
      id
      item_id
      image_url
      image_type
    }
  }
`;

const GET_ITEM_BY_ID = `
  query GetItemById($itemId: uuid!) {
    items_by_pk(id: $itemId) {
      id
      business_id
    }
  }
`;

const DELETE_BUSINESS_INVENTORY_BY_ITEM = `
  mutation DeleteBusinessInventoryByItem($itemId: uuid!) {
    delete_business_inventory(where: { item_id: { _eq: $itemId } }) {
      affected_rows
    }
  }
`;

const UPDATE_ITEM_STATUS = `
  mutation UpdateItemStatus($itemId: uuid!, $status: item_status_enum!) {
    update_items_by_pk(pk_columns: { id: $itemId }, _set: { status: $status }) {
      id
      status
    }
  }
`;

@Injectable()
export class BusinessItemsService {
  private readonly logger = new Logger(BusinessItemsService.name);

  constructor(private readonly hasuraUserService: HasuraUserService) {}

  async getItems(businessId: string) {
    const result = await this.hasuraUserService.executeQuery<{ items: any[] }>(
      GET_ITEMS,
      { businessId }
    );
    return result.items ?? [];
  }

  async getItemSubCategoryIds(): Promise<Set<number>> {
    const result =
      await this.hasuraUserService.executeQuery<{
        item_sub_categories: { id: number }[];
      }>(GET_ITEM_SUB_CATEGORY_IDS, {});
    const list = result?.item_sub_categories ?? [];
    return new Set(list.map((s) => s.id));
  }

  async getBusinessLocations(businessId: string) {
    const result =
      await this.hasuraUserService.executeQuery<{
        business_locations: any[];
      }>(GET_BUSINESS_LOCATIONS, { businessId });
    return result.business_locations ?? [];
  }

  async getAvailableItems() {
    const result = await this.hasuraUserService.executeQuery<{ items: any[] }>(
      GET_AVAILABLE_ITEMS
    );
    return result.items ?? [];
  }

  /**
   * Fetch all data needed for the business items page in one call.
   * Runs items, locations, and available-items queries in parallel.
   */
  async getPageData(businessId: string) {
    const [items, business_locations, available_items] = await Promise.all([
      this.getItems(businessId),
      this.getBusinessLocations(businessId),
      this.getAvailableItems(),
    ]);
    return { items, business_locations, available_items };
  }

  async getBusinessInventory(businessId: string) {
    const result =
      await this.hasuraUserService.executeQuery<{
        business_inventory: any[];
      }>(GET_BUSINESS_INVENTORY, { businessId });
    return result.business_inventory ?? [];
  }

  /**
   * Soft-delete an item: clear business_inventory for the item, then set item status to 'deleted'.
   * Throws 404 if item not found, 403 if item is not owned by the business.
   */
  async deleteItem(businessId: string, itemId: string): Promise<void> {
    const itemResult = await this.hasuraUserService.executeQuery<{
      items_by_pk: { id: string; business_id: string } | null;
    }>(GET_ITEM_BY_ID, { itemId });
    const item = itemResult?.items_by_pk;
    if (!item) {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
    if (item.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found or not owned by business' },
        HttpStatus.FORBIDDEN
      );
    }
    await this.hasuraUserService.executeMutation(DELETE_BUSINESS_INVENTORY_BY_ITEM, {
      itemId,
    });
    await this.hasuraUserService.executeMutation(UPDATE_ITEM_STATUS, {
      itemId,
      status: 'deleted',
    });
  }

  async processCsvRows(
    businessId: string,
    userId: string,
    rows: CsvItemRowDto[]
  ): Promise<CsvUploadResultDto> {
    this.logger.log(`CSV upload: starting for businessId=${businessId} rows=${rows.length}`);
    const [items, locations, inventory, validSubCategoryIds] = await Promise.all([
      this.getItems(businessId),
      this.getBusinessLocations(businessId),
      this.getBusinessInventory(businessId),
      this.getItemSubCategoryIds(),
    ]);

    const details: CsvUploadResultDto['details'] = {
      inserted: [],
      updated: [],
      errors: [],
    };
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // 1-based + header

      try {
        // Resolve location by name (case-insensitive)
        const location = locations.find(
          (loc) =>
            loc.name?.toLowerCase() ===
            (row.business_location_name || '').trim().toLowerCase()
        );
        if (!location) {
          throw new Error(
            `Location "${row.business_location_name}" not found`
          );
        }

        // Match existing item by name or SKU
        const existingItem = items.find(
          (existing) =>
            existing.name?.toLowerCase() === (row.name || '').trim().toLowerCase() ||
            (row.sku &&
              existing.sku &&
              existing.sku.toLowerCase() === row.sku.trim().toLowerCase())
        );

        let itemId: string;

        if (existingItem) {
          const isSkuConflict =
            existingItem.name?.toLowerCase() !== (row.name || '').trim().toLowerCase() &&
            row.sku &&
            existingItem.sku &&
            existingItem.sku.toLowerCase() === row.sku.trim().toLowerCase();
          if (isSkuConflict) {
            throw new Error(
              `SKU "${row.sku}" is already used by item "${existingItem.name}". Cannot update item "${row.name}" with conflicting SKU.`
            );
          }

          const resolvedSubCategoryId =
            row.item_sub_category_id != null && validSubCategoryIds.has(row.item_sub_category_id)
              ? row.item_sub_category_id
              : undefined;
          const itemData = {
            name: row.name,
            description: row.description ?? '',
            ...(resolvedSubCategoryId !== undefined && { item_sub_category_id: resolvedSubCategoryId }),
            price: row.price,
            currency: row.currency,
            ...(row.sku === existingItem.sku || !existingItem.sku
              ? { sku: row.sku }
              : {}),
            weight: row.weight,
            weight_unit: row.weight_unit,
            dimensions: row.dimensions?.trim() || undefined,
            color: row.color,
            model: row.model,
            is_fragile: row.is_fragile,
            is_perishable: row.is_perishable,
            requires_special_handling: row.requires_special_handling,
            min_order_quantity: row.min_order_quantity,
            max_order_quantity: row.max_order_quantity,
            is_active: row.is_active,
            brand_id: row.brand_id,
          };
          await this.hasuraUserService.executeMutation(UPDATE_ITEM, {
            id: existingItem.id,
            itemData,
          });
          this.logger.log(`CSV upload: updated item id=${existingItem.id} name="${row.name}"`);
          details.updated.push(`Item: ${row.name}`);
          updatedCount++;
          itemId = existingItem.id;
        } else {
          const skuExists = items.some(
            (existing) =>
              row.sku &&
              existing.sku &&
              existing.sku.toLowerCase() === row.sku.trim().toLowerCase()
          );
          if (skuExists) {
            throw new Error(
              `SKU "${row.sku}" already exists. Cannot create item "${row.name}" with duplicate SKU.`
            );
          }

          const resolvedSubCategoryIdForInsert =
            row.item_sub_category_id != null && validSubCategoryIds.has(row.item_sub_category_id)
              ? row.item_sub_category_id
              : undefined;
          const insertData = {
            name: row.name,
            description: row.description ?? '',
            ...(resolvedSubCategoryIdForInsert !== undefined && { item_sub_category_id: resolvedSubCategoryIdForInsert }),
            price: row.price,
            currency: row.currency,
            business_id: businessId,
            sku: row.sku,
            weight: row.weight,
            weight_unit: row.weight_unit,
            dimensions: row.dimensions?.trim() || undefined,
            color: row.color,
            model: row.model,
            is_fragile: row.is_fragile,
            is_perishable: row.is_perishable,
            requires_special_handling: row.requires_special_handling,
            min_order_quantity: row.min_order_quantity,
            max_order_quantity: row.max_order_quantity,
            is_active: row.is_active,
            brand_id: row.brand_id,
          };
          const insertResult = await this.hasuraUserService.executeMutation<{
            insert_items_one: { id: string };
          }>(INSERT_ITEM, { itemData: insertData });
          const newItem = insertResult?.insert_items_one;
          if (!newItem?.id) {
            throw new Error('Failed to create item');
          }
          itemId = newItem.id;
          this.logger.log(`CSV upload: inserted item id=${itemId} name="${row.name}"`);
          details.inserted.push(`Item: ${row.name}`);
          insertedCount++;
          items.push({
            id: itemId,
            name: row.name,
            sku: row.sku,
            business_inventories: [],
          } as any);
        }

        // Inventory: create or update
        const existingInv = inventory.find(
          (inv) =>
            inv.item_id === itemId &&
            inv.business_location_id === location.id
        );

        const inventoryPayload = {
          business_location_id: location.id,
          item_id: itemId,
          quantity: row.quantity,
          reserved_quantity: row.reserved_quantity,
          reorder_point: row.reorder_point,
          reorder_quantity: row.reorder_quantity,
          unit_cost: row.unit_cost,
          selling_price: row.selling_price,
          is_active: row.is_active ?? true,
        };

        if (existingInv) {
          const updatePayload = {
            quantity: row.quantity,
            reserved_quantity: row.reserved_quantity,
            reorder_point: row.reorder_point,
            reorder_quantity: row.reorder_quantity,
            unit_cost: row.unit_cost,
            selling_price: row.selling_price,
            is_active: row.is_active ?? true,
          };
          await this.hasuraUserService.executeMutation(
            UPDATE_BUSINESS_INVENTORY,
            {
              itemId: existingInv.id,
              updates: updatePayload,
            }
          );
          this.logger.log(`CSV upload: updated inventory item="${row.name}" location="${row.business_location_name}" invId=${existingInv.id}`);
          details.updated.push(
            `Inventory: ${row.name} at ${row.business_location_name}`
          );
          updatedCount++;
        } else {
          await this.hasuraUserService.executeMutation(
            INSERT_BUSINESS_INVENTORY,
            { itemData: inventoryPayload }
          );
          this.logger.log(`CSV upload: inserted inventory item="${row.name}" location="${row.business_location_name}"`);
          details.inserted.push(
            `Inventory: ${row.name} at ${row.business_location_name}`
          );
          insertedCount++;
          inventory.push({
            id: '',
            item_id: itemId,
            business_location_id: location.id,
          } as any);
        }

        // Optional image
        if (row.image_url) {
          try {
            const imgResult =
              await this.hasuraUserService.executeQuery<{
                item_images: { id: string; image_type: string }[];
              }>(GET_ITEM_IMAGES, { itemId });
            const existingImages = imgResult?.item_images ?? [];
            const mainImage = existingImages.find(
              (img) => img.image_type === 'main'
            );
            if (mainImage) {
              await this.hasuraUserService.executeMutation(DELETE_ITEM_IMAGE, {
                id: mainImage.id,
              });
            }
            await this.hasuraUserService.executeMutation(INSERT_ITEM_IMAGE, {
              imageData: {
                item_id: itemId,
                image_url: row.image_url,
                image_type: 'main',
                alt_text: row.image_alt_text || row.name,
                caption: row.image_caption,
                display_order: 1,
                uploaded_by: userId,
              },
            });
            this.logger.log(`CSV upload: inserted image for item="${row.name}" id=${itemId}`);
            details.inserted.push(`Image: ${row.name}`);
            insertedCount++;
          } catch (imageErr) {
            const errMsg = imageErr instanceof Error ? imageErr.message : 'Unknown error';
            this.logger.error(`CSV upload: image upload failed for item="${row.name}" row=${rowIndex}: ${errMsg}`);
            details.errors.push({
              row: rowIndex,
              error: `Image upload failed: ${errMsg}`,
            });
          }
        }
      } catch (err) {
        errorCount++;
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(`CSV upload: error row=${rowIndex} item="${row?.name ?? 'unknown'}": ${errMsg}`);
        details.errors.push({
          row: rowIndex,
          error: errMsg,
        });
      }
    }

    this.logger.log(
      `CSV upload: completed businessId=${businessId} inserted=${insertedCount} updated=${updatedCount} errors=${errorCount}`
    );
    return {
      success: rows.length - errorCount,
      inserted: insertedCount,
      updated: updatedCount,
      errors: errorCount,
      details,
    };
  }
}
