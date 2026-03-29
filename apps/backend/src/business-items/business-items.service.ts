import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BusinessImagesService } from '../business-images/business-images.service';
import { AiService } from '../ai/ai.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CreateItemFromImageDto } from './dto/create-item-from-image.dto';
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
      item_images(order_by: { display_order: asc }) {
        id
        image_url
        image_type
        alt_text
        display_order
        created_at
      }
      item_tags {
        tag_id
        tag {
          id
          name
        }
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
      phone
      email
      location_type
      is_active
      is_primary
      rendasua_item_commission_percentage
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

const GET_SINGLE_ITEM = `
  query GetSingleItem($id: uuid!) {
    items_by_pk(id: $id) {
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
      item_images(order_by: { display_order: asc }) {
        id
        image_url
        image_type
        alt_text
        display_order
        created_at
      }
      item_tags {
        tag_id
        tag {
          id
          name
        }
      }
      business_inventories {
        id
        business_location_id
        quantity
        computed_available_quantity
        reserved_quantity
        reorder_point
        reorder_quantity
        unit_cost
        selling_price
        is_active
        last_restocked_at
        created_at
        updated_at
        business_location {
          id
          name
          location_type
          business_id
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
    update_items_by_pk(
      pk_columns: { id: $id }
      _set: $itemData
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

const FIND_CATEGORY_AND_SUBCATEGORY_BY_NAME = `
  query FindCategoryAndSubcategory(
    $categoryName: String!,
    $subCategoryName: String!
  ) {
    item_sub_categories(
      where: {
        name: { _eq: $subCategoryName },
        item_category: {
          name: { _eq: $categoryName }
        }
      },
      limit: 1
    ) {
      id
      item_category_id
      item_category {
        id
        name
      }
    }
  }
`;

const FIND_CATEGORY_BY_NAME = `
  query FindCategoryByName($categoryName: String!) {
    item_categories(
      where: { name: { _eq: $categoryName } },
      limit: 1
    ) {
      id
      name
    }
  }
`;

const FIND_BRAND_BY_NAME = `
  query FindBrandByName($name: String!) {
    brands(where: { name: { _ilike: $name } }, limit: 1) {
      id
      name
    }
  }
`;

const INSERT_BRAND = `
  mutation InsertBrand($name: String!) {
    insert_brands_one(
      object: { name: $name, description: $name, approved: true },
      on_conflict: {
        constraint: brands_name_key,
        update_columns: [name]
      }
    ) {
      id
      name
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

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly businessImagesService: BusinessImagesService,
    private readonly aiService: AiService
  ) {}

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

  async getBusinessPrimaryAddressCountry(businessId: string): Promise<string | null> {
    return this.hasuraSystemService.getBusinessPrimaryAddressCountry(businessId);
  }

  /**
   * Create a business location with address and account.
   * Provide either a new `address` (country = business primary) or an existing
   * `address_id` already linked to the business in business_addresses.
   */
  async createBusinessLocation(
    businessId: string,
    data: {
      name: string;
      address?: {
        address_line_1: string;
        address_line_2?: string;
        city: string;
        state: string;
        postal_code: string;
      };
      address_id?: string;
      phone?: string;
      email?: string;
      location_type?: 'store' | 'warehouse' | 'office' | 'pickup_point';
      is_primary?: boolean;
      rendasua_item_commission_percentage?: number | null;
    }
  ): Promise<any> {
    let addressId: string;
    if (data.address_id) {
      if (data.address) {
        throw new HttpException(
          {
            success: false,
            error: 'Send either address or address_id, not both.',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      const owns =
        await this.hasuraSystemService.verifyBusinessAddressOwnership(
          businessId,
          data.address_id
        );
      if (!owns) {
        throw new HttpException(
          {
            success: false,
            error: 'Invalid address_id for this business.',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      addressId = data.address_id;
    } else if (data.address) {
      const country =
        await this.hasuraSystemService.getBusinessPrimaryAddressCountry(
          businessId
        );
      if (!country) {
        throw new HttpException(
          {
            success: false,
            error: 'Add a business address first before adding locations.',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      const addressMutation = `
      mutation CreateAddress($addressLine1: String!, $addressLine2: String, $city: String!, $state: String!, $postalCode: String!, $country: String!) {
        insert_addresses_one(object: {
          address_line_1: $addressLine1,
          address_line_2: $addressLine2,
          city: $city,
          state: $state,
          postal_code: $postalCode,
          country: $country,
          address_type: "home"
        }) { id }
      }
    `;
      const addressResult = await this.hasuraSystemService.executeMutation<{
        insert_addresses_one: { id: string };
      }>(addressMutation, {
        addressLine1: data.address.address_line_1,
        addressLine2: data.address.address_line_2 ?? null,
        city: data.address.city,
        state: data.address.state,
        postalCode: data.address.postal_code ?? '',
        country,
      });
      addressId = addressResult.insert_addresses_one?.id ?? '';
      if (!addressId) {
        throw new HttpException(
          { success: false, error: 'Failed to create address' },
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    } else {
      throw new HttpException(
        {
          success: false,
          error: 'Either address or address_id is required.',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const locationMutation = `
      mutation CreateBusinessLocation($businessId: uuid!, $addressId: uuid!, $name: String!, $locationType: location_type_enum!, $isPrimary: Boolean!, $phone: String, $email: String, $commission: numeric) {
        insert_business_locations_one(object: {
          business_id: $businessId,
          address_id: $addressId,
          name: $name,
          location_type: $locationType,
          is_primary: $isPrimary,
          phone: $phone,
          email: $email,
          rendasua_item_commission_percentage: $commission,
          is_active: true
        }) {
          id
          name
          phone
          email
          location_type
          is_primary
          is_active
          address { id address_line_1 address_line_2 city state postal_code country }
        }
      }
    `;
    const locationResult = await this.hasuraSystemService.executeMutation(locationMutation, {
      businessId,
      addressId,
      name: data.name,
      locationType: data.location_type ?? 'store',
      isPrimary: data.is_primary ?? false,
      phone: data.phone ?? null,
      email: data.email ?? null,
      commission: data.rendasua_item_commission_percentage ?? null,
    });
    const location = (locationResult as any).insert_business_locations_one;
    if (!location?.id) {
      throw new HttpException(
        { success: false, error: 'Failed to create business location' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    await this.hasuraSystemService.ensureAccountForBusinessLocation(location.id);
    return location;
  }

  /**
   * Update business location fields (e.g. rendasua_item_commission_percentage).
   * Only updates location row; address updates go through addresses API.
   */
  async updateBusinessLocation(
    businessId: string,
    locationId: string,
    data: {
      name?: string;
      phone?: string;
      email?: string;
      location_type?: 'store' | 'warehouse' | 'office' | 'pickup_point';
      is_active?: boolean;
      is_primary?: boolean;
      rendasua_item_commission_percentage?: number | null;
    }
  ): Promise<any> {
    const query = `
      query GetLocationBusiness($locationId: uuid!) {
        business_locations_by_pk(id: $locationId) {
          id
          business_id
        }
      }
    `;
    const row = await this.hasuraUserService.executeQuery<{
      business_locations_by_pk: { id: string; business_id: string } | null;
    }>(query, { locationId });
    const loc = row?.business_locations_by_pk;
    if (!loc || loc.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Location not found or access denied' },
        HttpStatus.NOT_FOUND
      );
    }
    const updateMutation = `
      mutation UpdateBusinessLocation($id: uuid!, $data: business_locations_set_input!) {
        update_business_locations_by_pk(pk_columns: { id: $id }, _set: $data) {
          id
          name
          phone
          email
          rendasua_item_commission_percentage
          location_type
          is_active
          is_primary
          address { id address_line_1 address_line_2 city state postal_code country }
        }
      }
    `;
    const result = await this.hasuraUserService.executeMutation(updateMutation, {
      id: locationId,
      data,
    });
    return result?.update_business_locations_by_pk ?? null;
  }

  async getSingleItem(businessId: string, itemId: string) {
    const result = await this.hasuraUserService.executeQuery<{
      items_by_pk: any | null;
    }>(GET_SINGLE_ITEM, { id: itemId });
    const item = result.items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new Error('Item not found or does not belong to this business');
    }
    return item;
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

  async updateInventoryItem(
    businessId: string,
    inventoryId: string,
    updates: {
      quantity?: number;
      reserved_quantity?: number;
      reorder_point?: number;
      reorder_quantity?: number;
      unit_cost?: number;
      selling_price?: number;
      is_active?: boolean;
    }
  ) {
    const invResult = await this.hasuraUserService.executeQuery<{
      business_inventory_by_pk: {
        id: string;
        business_location: { business_id: string };
      } | null;
    }>(
      `
      query GetInventoryWithBusiness($id: uuid!) {
        business_inventory_by_pk(id: $id) {
          id
          business_location {
            business_id
          }
        }
      }
    `,
      { id: inventoryId }
    );
    const inv = invResult.business_inventory_by_pk;
    if (!inv || inv.business_location.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Inventory not found' },
        HttpStatus.NOT_FOUND
      );
    }

    const result = await this.hasuraUserService.executeMutation<{
      update_business_inventory_by_pk: {
        id: string;
        item_id: string;
        business_location_id: string;
      } | null;
    }>(UPDATE_BUSINESS_INVENTORY, {
      itemId: inventoryId,
      updates,
    });

    return result.update_business_inventory_by_pk;
  }

  async updateItem(
    businessId: string,
    itemId: string,
    updates: {
      name?: string;
      description?: string;
      item_sub_category_id?: number;
      weight?: number | null;
      weight_unit?: string | null;
      dimensions?: string | null;
      price?: number;
      currency?: string;
      sku?: string | null;
      brand_id?: string | null;
      model?: string | null;
      color?: string | null;
      is_fragile?: boolean;
      is_perishable?: boolean;
      requires_special_handling?: boolean;
      max_delivery_distance?: number | null;
      estimated_delivery_time?: number | null;
      min_order_quantity?: number;
      max_order_quantity?: number | null;
      is_active?: boolean;
    }
  ) {
    const result = await this.hasuraUserService.executeQuery<{
      items_by_pk: { id: string; business_id: string } | null;
    }>(GET_ITEM_BY_ID, { itemId });
    const item = result?.items_by_pk;

    if (!item || item.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found or not owned by business' },
        HttpStatus.FORBIDDEN
      );
    }

    const itemData = {
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates, 'description') &&
      (updates.description === undefined || updates.description === null)
        ? { description: '' }
        : {}),
    };

    const mutationResult =
      await this.hasuraUserService.executeMutation<{
        update_items_by_pk: Record<string, unknown> | null;
      }>(UPDATE_ITEM, {
        id: itemId,
        itemData,
      });

    return mutationResult.update_items_by_pk;
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
    rows: CsvItemRowDto[],
    rowOffset = 0
  ): Promise<CsvUploadResultDto> {
    this.logger.log(`CSV upload: starting for businessId=${businessId} rows=${rows.length} rowOffset=${rowOffset}`);
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
      const rowIndex = rowOffset + i + 2; // 1-based + header, adjusted for batch offset

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
                business_id: businessId,
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

  async createItemFromImage(
    businessId: string,
    dto: CreateItemFromImageDto,
    preferredLanguage = 'en'
  ): Promise<any> {
    const image = await this.businessImagesService.getImageForBusiness(
      businessId,
      dto.imageId
    );
    if (image.item_id) {
      throw new HttpException(
        {
          success: false,
          error: 'Image is already linked to an item',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const generatedDescription = await this.generateDescriptionFromImageIfMissing(
      dto,
      image.image_url,
      image.caption,
      image.alt_text,
      preferredLanguage
    );

    const name = dto.name.trim();
    const baseSku = this.buildSkuBase(name);
    const sku = await this.generateUniqueSku(businessId, baseSku);

    const hasPrice = dto.price != null && !Number.isNaN(dto.price as number);
    const price = hasPrice ? (dto.price as number) : undefined;
    const currency =
      hasPrice && dto.currency
        ? dto.currency
        : hasPrice
        ? 'XAF'
        : undefined;

    const categoryName = dto.categoryName?.trim();
    const subCategoryName = dto.subCategoryName?.trim();
    const brandName = dto.brandName?.trim();

    const subCategoryId =
      categoryName && subCategoryName
        ? await this.ensureSubCategoryId(
            categoryName,
            subCategoryName
          )
        : null;

    const brandId = brandName
      ? await this.ensureBrandId(brandName)
      : null;

    const insertData = {
      business_id: businessId,
      name,
      description: generatedDescription,
      sku,
      ...(subCategoryId != null && { item_sub_category_id: subCategoryId }),
      ...(brandId && { brand_id: brandId }),
      ...(hasPrice && { price }),
      ...(currency && { currency }),
      min_order_quantity: 1,
      max_order_quantity: 1,
      is_active: false,
    };

    const insertResult = await this.hasuraUserService.executeMutation<{
      insert_items_one: { id: string; name: string; sku: string | null };
    }>(INSERT_ITEM, { itemData: insertData });
    const newItem = insertResult?.insert_items_one;
    if (!newItem?.id) {
      throw new HttpException(
        { success: false, error: 'Failed to create item from image' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    await this.businessImagesService.linkLibraryImageToNewItem(
      businessId,
      image.id,
      newItem.id
    );

    return {
      id: newItem.id,
      name: newItem.name,
      sku: newItem.sku,
    };
  }

  private async generateDescriptionFromImageIfMissing(
    dto: CreateItemFromImageDto,
    imageUrl: string,
    caption: string | null,
    altText: string | null,
    preferredLanguage: string
  ): Promise<string> {
    const providedDescription = dto.description?.trim();
    if (providedDescription) {
      return providedDescription;
    }
    const aiSuggestion = await this.aiService.generateImageItemSuggestions({
      imageUrl,
      caption,
      altText,
      defaultCurrency: 'XAF',
      preferredLanguage,
    });
    return aiSuggestion.description?.trim() ?? '';
  }

  private buildSkuBase(name: string): string {
    const cleaned = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!cleaned) {
      return 'ITEM';
    }
    return cleaned.length > 12 ? cleaned.slice(0, 12) : cleaned;
  }

  private async generateUniqueSku(
    businessId: string,
    base: string
  ): Promise<string> {
    const query = `
      query CheckItemSkus($businessId: uuid!, $prefix: String!) {
        items(
          where: {
            business_id: { _eq: $businessId },
            sku: { _ilike: $prefix }
          }
        ) {
          sku
        }
      }
    `;
    const prefix = `${base}%`;
    const result = await this.hasuraSystemService.executeQuery<{
      items: { sku: string | null }[];
    }>(query, { businessId, prefix });
    const existingSkus = (result.items ?? [])
      .map((i) => i.sku)
      .filter((s): s is string => !!s);
    if (!existingSkus.includes(base)) {
      return base;
    }
    let counter = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const candidate = `${base}-${counter}`;
      if (!existingSkus.includes(candidate)) {
        return candidate;
      }
      counter++;
    }
  }

  private async ensureSubCategoryId(
    categoryName: string,
    subCategoryName: string
  ): Promise<number> {
    const existingSub =
      await this.hasuraSystemService.executeQuery<{
        item_sub_categories: {
          id: number;
          item_category_id: number;
        }[];
      }>(FIND_CATEGORY_AND_SUBCATEGORY_BY_NAME, {
        categoryName,
        subCategoryName,
      });
    const existing = existingSub.item_sub_categories?.[0];
    if (existing) {
      return existing.id;
    }

    const categoryLookup =
      await this.hasuraSystemService.executeQuery<{
        item_categories: { id: number }[];
      }>(FIND_CATEGORY_BY_NAME, { categoryName });
    const existingCategory = categoryLookup.item_categories?.[0];

    let categoryId = existingCategory?.id ?? null;
    if (categoryId == null) {
      try {
        const categoryResult =
          await this.hasuraSystemService.executeMutation<{
            insert_item_categories_one: { id: number };
          }>(
            `
            mutation InsertCategory($categoryName: String!) {
              insert_item_categories_one(
                object: { name: $categoryName, status: active }
              ) {
                id
              }
            }
          `,
            { categoryName }
          );
        categoryId = categoryResult.insert_item_categories_one?.id ?? null;
      } catch (error: any) {
        const message: string =
          error?.response?.errors?.[0]?.message || String(error?.message || '');
        const isConstraintViolation = message.includes('constraint-violation');
        if (!isConstraintViolation) {
          throw error;
        }
        const retryLookup =
          await this.hasuraSystemService.executeQuery<{
            item_categories: { id: number }[];
          }>(FIND_CATEGORY_BY_NAME, { categoryName });
        categoryId = retryLookup.item_categories?.[0]?.id ?? null;
      }
    }
    if (categoryId == null) {
      throw new HttpException(
        { success: false, error: 'Failed to ensure item category' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    const subResult =
      await this.hasuraSystemService.executeMutation<{
        insert_item_sub_categories_one: { id: number };
      }>(
        `
        mutation InsertSubcategory(
          $categoryId: Int!,
          $subCategoryName: String!
        ) {
          insert_item_sub_categories_one(
            object: {
              item_category_id: $categoryId,
              name: $subCategoryName,
              status: active
            }
          ) {
            id
          }
        }
      `,
        { categoryId, subCategoryName }
      );
    const subId = subResult.insert_item_sub_categories_one?.id;
    if (subId == null) {
      throw new HttpException(
        { success: false, error: 'Failed to ensure item subcategory' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return subId;
  }

  private async ensureBrandId(name: string): Promise<string> {
    const searchResult =
      await this.hasuraSystemService.executeQuery<{
        brands: { id: string }[];
      }>(FIND_BRAND_BY_NAME, { name });
    const existing = searchResult.brands?.[0];
    if (existing?.id) {
      return existing.id;
    }
    const insertResult =
      await this.hasuraSystemService.executeMutation<{
        insert_brands_one: { id: string };
      }>(INSERT_BRAND, { name });
    const brand = insertResult.insert_brands_one;
    if (!brand?.id) {
      throw new HttpException(
        { success: false, error: 'Failed to ensure brand' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return brand.id;
  }
}
