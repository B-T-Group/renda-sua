import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BusinessImagesService } from '../business-images/business-images.service';
import { AiService } from '../ai/ai.service';
import { CreateItemDto } from '../items/dto/create-item.dto';
import { ItemsService, type ItemsInsertInput } from '../items/items.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { ImageThumbnailsService } from '../image-thumbnails/image-thumbnails.service';
import { postalCodeForStorage } from '../addresses/postal-code.util';
import { CreateItemFromImageDto } from './dto/create-item-from-image.dto';
import type { CsvItemRowDto, CsvUploadResultDto } from './dto/csv-upload.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateItemPromotionDto } from './dto/update-item-promotion.dto';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { STRIPE_TAX_CODE_GENERAL_TANGIBLE } from '../stripe-tax/stripe-tax.constants';
import { StripeTaxCodesService } from '../stripe-tax/stripe-tax-codes.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { ItemAiReviewService } from '../item-ai-review/item-ai-review.service';
import { resolveSaleItemRejectionReason } from '../common/moderation-rejection-reason';
import { resolvePayOnDeliveryDefault } from './item-payment-defaults.util';
import { resolveInitialInventoryQuantity } from '../food/food-inventory-quantity.util';

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
      pay_on_delivery_enabled
      pay_at_pickup_enabled
      shipping_enabled
      shipping_price
      shipping_currency
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
      is_used
      requires_special_handling
      max_delivery_distance
      estimated_delivery_time
      min_order_quantity
      max_order_quantity
      is_active
      moderation_status
      moderated_at
      moderation_source
      business_id
      stripe_tax_code_id
      stripe_tax_code {
        id
        name
        description
        group_name
      }
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
        google_product_category
        fb_product_category
        google_product_category_row {
          id
          name_en
          name_fr
        }
        fb_product_category_row {
          id
          name_en
          name_fr
        }
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
        is_ai_cleaned
        is_rembg_cleaned
        original_image_url
        enhanced_image_url
        rembg_image_url
        active_version
        thumbnail
        thumbnail_status
        display_url
        created_at
      }
      item_tags {
        tag_id
        tag {
          id
          name
        }
      }
      item_collections {
        collection_id
        collection {
          id
          slug
          name_en
          name_fr
        }
      }
      item_variants(order_by: { sort_order: asc }) {
        id
        name
        sku
        price
        weight
        weight_unit
        dimensions
        color
        attributes
        is_default
        is_active
        sort_order
        item_variant_images(order_by: { display_order: asc }) {
          id
          display_url
          thumbnail
          thumbnail_status
          image_url
          alt_text
          caption
          display_order
          is_primary
        }
      }
      business_inventories {
        id
        item_id
        item_variant_id
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
        promotion
        item_variant {
          id
          name
          sku
        }
        variant_price_overrides {
          id
          item_variant_id
          selling_price
        }
        item_deals {
          id
          start_at
          end_at
          is_active
        }
        business_location {
          id
          name
          address_id
        }
      }
    }
  }
`;

const GET_ITEMS_BY_MODERATION_STATUS = `
  query GetItemsByModerationStatus(
    $businessId: uuid!
    $moderationStatus: item_moderation_status!
  ) {
    items(
      where: {
        business_id: { _eq: $businessId }
        status: { _eq: active }
        moderation_status: { _eq: $moderationStatus }
      }
      order_by: { updated_at: desc }
    ) {
      id
      name
      description
      price
      currency
      moderation_status
      is_active
      created_at
      updated_at
      item_images(order_by: { display_order: asc }, limit: 1) {
        id
        image_url
        display_url
        thumbnail
      }
    }
  }
`;

const GET_BUSINESS_LOCATIONS = `
  query GetBusinessLocations($businessId: uuid!) {
    business_locations(
      where: {
        business_id: { _eq: $businessId }
        _or: [
          { address_id: { _is_null: true } }
          { address: { status: { _eq: active } } }
        ]
      }
      order_by: { name: asc }
    ) {
      id
      name
      phone
      mobile_payment_phone_id
      email
      operating_hours
      location_type
      is_active
      is_primary
      rendasua_item_commission_percentage
      auto_withdraw_commissions
      logo_url
      created_at
      updated_at
      mobile_payment_phone {
        id
        phone_e164
        is_verified
        verified_at
      }
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
      pay_on_delivery_enabled
      pay_at_pickup_enabled
      shipping_enabled
      shipping_price
      shipping_currency
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
      is_used
      requires_special_handling
      max_delivery_distance
      estimated_delivery_time
      min_order_quantity
      max_order_quantity
      is_active
      moderation_status
      moderated_at
      moderation_source
      business_id
      stripe_tax_code_id
      stripe_tax_code {
        id
        name
        description
        group_name
      }
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
        google_product_category
        fb_product_category
        google_product_category_row {
          id
          name_en
          name_fr
        }
        fb_product_category_row {
          id
          name_en
          name_fr
        }
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
        is_ai_cleaned
        is_rembg_cleaned
        original_image_url
        enhanced_image_url
        rembg_image_url
        active_version
        thumbnail
        thumbnail_status
        display_url
        created_at
      }
      item_tags {
        tag_id
        tag {
          id
          name
        }
      }
      item_collections {
        collection_id
        collection {
          id
          slug
          name_en
          name_fr
        }
      }
      item_variants(order_by: { sort_order: asc }) {
        id
        name
        sku
        price
        weight
        weight_unit
        dimensions
        color
        attributes
        is_default
        is_active
        sort_order
        item_variant_images(order_by: { display_order: asc }) {
          id
          display_url
          thumbnail
          thumbnail_status
          image_url
          alt_text
          caption
          display_order
          is_primary
        }
      }
      business_inventories {
        id
        item_variant_id
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
        promotion
        item_variant {
          id
          name
          sku
        }
        item_deals {
          id
          start_at
          end_at
          is_active
        }
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

const PUBLISH_ITEM_FROM_DRAFT = `
  mutation PublishItemFromDraft($id: uuid!) {
    update_items(
      where: {
        id: { _eq: $id }
        moderation_status: { _eq: draft }
        status: { _eq: active }
      }
      _set: {
        moderation_status: pending
        moderated_at: null
        moderated_by_user_id: null
        moderation_source: null
        is_active: false
      }
    ) {
      affected_rows
      returning {
        id
        moderation_status
      }
    }
  }
`;

const RESET_ITEM_MODERATION_PENDING = `
  mutation ResetItemModerationPending($id: uuid!) {
    update_items_by_pk(
      pk_columns: { id: $id }
      _set: {
        moderation_status: pending
        moderated_at: null
        moderated_by_user_id: null
        moderation_source: null
        is_active: false
      }
    ) {
      id
    }
  }
`;

const GET_ITEM_MODERATION_ROW = `
  query GetItemModerationRow($itemId: uuid!) {
    items_by_pk(id: $itemId) {
      id
      business_id
      moderation_status
      name
      description
      status
    }
  }
`;

const GET_AVAILABLE_ITEMS = `
  query GetAvailableItems {
    items(
      where: { 
        is_active: { _eq: true },
        status: { _eq: active },
        moderation_status: { _eq: approved },
        business: { is_storefront_visible: { _eq: true } }
      }
      order_by: { name: asc }
    ) {
      id
      name
      description
      pay_on_delivery_enabled
      pay_at_pickup_enabled
      shipping_enabled
      shipping_price
      shipping_currency
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
      is_used
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
      item_variant_id
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
      promotion
      business_location {
        id
        name
      }
      item {
        id
        name
        sku
      }
      item_variant {
        id
        name
        sku
      }
      variant_price_overrides {
        id
        item_variant_id
        selling_price
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
      item_variant_id
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

const UPDATE_BUSINESS_INVENTORY_PROMOTION_BULK = `
  mutation UpdateInventoryPromotionBulk(
    $businessId: uuid!
    $itemId: uuid!
    $promotion: jsonb
  ) {
    update_business_inventory(
      where: {
        item_id: { _eq: $itemId }
        business_location: { business_id: { _eq: $businessId } }
      }
      _set: { promotion: $promotion }
    ) {
      affected_rows
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

const DEFAULT_DRAFT_CATEGORY_NAME = 'Other';
const DEFAULT_DRAFT_SUB_CATEGORY_NAME = 'Other';

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
      name
      description
      sku
      price
      moderation_status
      item_sub_category {
        item_category {
          name
        }
      }
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

const DELETE_BUSINESS_INVENTORY_BY_PK = `
  mutation DeleteBusinessInventoryByPk($id: uuid!) {
    delete_business_inventory_by_pk(id: $id) {
      id
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

const GET_FAVORITE_ITEM_IDS = `
  query GetFavoriteItemIds($businessId: uuid!) {
    business_item_favorites(where: { business_id: { _eq: $businessId } }) {
      item_id
    }
  }
`;

const INSERT_ITEM_FAVORITE = `
  mutation InsertItemFavorite($businessId: uuid!, $itemId: uuid!) {
    insert_business_item_favorites_one(
      object: { business_id: $businessId, item_id: $itemId }
    ) {
      id
    }
  }
`;

const DELETE_ITEM_FAVORITE = `
  mutation DeleteItemFavorite($businessId: uuid!, $itemId: uuid!) {
    delete_business_item_favorites(
      where: { business_id: { _eq: $businessId }, item_id: { _eq: $itemId } }
    ) {
      affected_rows
    }
  }
`;

const GET_ITEM_BUSINESS = `
  query GetItemBusiness($id: uuid!) {
    items_by_pk(id: $id) {
      id
      business_id
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
    private readonly aiService: AiService,
    private readonly itemsService: ItemsService,
    private readonly itemAiReviewService: ItemAiReviewService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly merchantLifecycleService: MerchantLifecycleService,
    private readonly stripeTaxCodesService: StripeTaxCodesService,
    private readonly imageThumbnailsService: ImageThumbnailsService
  ) {}

  private triggerLifecycleRecompute(businessId: string): void {
    void this.merchantLifecycleService.recompute(
      businessId,
      'catalog_change'
    );
  }

  private getCsvItemActiveStateForUpdate(existingItem: {
    is_active?: boolean | null;
    moderation_status?: string | null;
  }): boolean {
    return (
      existingItem.moderation_status === 'approved' &&
      existingItem.is_active === true
    );
  }

  /**
   * Pay-at-delivery is an offline/mobile-money flow incompatible with card
   * (Stripe) markets. Store pickup remains available on Stripe — clients pay
   * online at checkout and collect the order at the store.
   */
  private async assertOfflinePaymentAllowed(
    businessId: string,
    updates: {
      pay_on_delivery_enabled?: unknown;
      pay_at_pickup_enabled?: unknown;
    }
  ): Promise<void> {
    if (updates.pay_on_delivery_enabled !== true) return;
    const rail = await this.paymentRoutingService.resolveRailForBusiness(
      businessId
    );
    if (rail === 'stripe') {
      throw new HttpException(
        {
          success: false,
          error:
            'Pay at delivery is not available in card-payment (Stripe) countries.',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /** When create payload omits pay-at-delivery, default on for MM rails. */
  private async withPayOnDeliveryDefault(
    businessId: string,
    input: ItemsInsertInput
  ): Promise<ItemsInsertInput> {
    const rail = await this.paymentRoutingService.resolveRailForBusiness(
      businessId
    );
    const explicit = input.pay_on_delivery_enabled;
    return {
      ...input,
      pay_on_delivery_enabled: resolvePayOnDeliveryDefault(
        rail,
        typeof explicit === 'boolean' ? explicit : undefined
      ),
    };
  }

  async getItems(
    businessId: string,
    options?: { moderationStatus?: string }
  ) {
    if (options?.moderationStatus) {
      const result = await this.hasuraUserService.executeQuery<{
        items: any[];
      }>(GET_ITEMS_BY_MODERATION_STATUS, {
        businessId,
        moderationStatus: options.moderationStatus,
      });
      return result.items ?? [];
    }
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
      mobile_payment_phone_id?: string | null;
      email?: string;
      location_type?: 'store' | 'warehouse' | 'office' | 'pickup_point';
      is_primary?: boolean;
      auto_withdraw_commissions?: boolean;
      logo_url?: string | null;
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
        postalCode: postalCodeForStorage(data.address.postal_code),
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
    const logoUrl =
      data.logo_url != null && String(data.logo_url).trim() !== ''
        ? String(data.logo_url).trim()
        : null;
    const phoneFields = await this.resolveLocationPhoneFields(
      businessId,
      data.mobile_payment_phone_id,
      data.phone
    );
    const locationMutation = `
      mutation CreateBusinessLocation($businessId: uuid!, $addressId: uuid!, $name: String!, $locationType: location_type_enum!, $isPrimary: Boolean!, $phone: String, $mobilePaymentPhoneId: uuid, $email: String, $autoWithdraw: Boolean!, $logoUrl: String) {
        insert_business_locations_one(object: {
          business_id: $businessId,
          address_id: $addressId,
          name: $name,
          location_type: $locationType,
          is_primary: $isPrimary,
          phone: $phone,
          mobile_payment_phone_id: $mobilePaymentPhoneId,
          email: $email,
          auto_withdraw_commissions: $autoWithdraw,
          logo_url: $logoUrl,
          is_active: true
        }) {
          id
          name
          phone
          mobile_payment_phone_id
          email
          location_type
          is_primary
          is_active
          auto_withdraw_commissions
          logo_url
          mobile_payment_phone {
            id phone_e164 is_verified verified_at
          }
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
      phone: phoneFields.phone,
      mobilePaymentPhoneId: phoneFields.mobilePaymentPhoneId,
      email: data.email ?? null,
      autoWithdraw: data.auto_withdraw_commissions ?? true,
      logoUrl,
    });
    const location = (locationResult as any).insert_business_locations_one;
    if (!location?.id) {
      throw new HttpException(
        { success: false, error: 'Failed to create business location' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    await this.hasuraSystemService.ensureAccountForBusinessLocation(location.id);
    // Primary/location country can change the payment rail → storefront visibility.
    this.triggerLifecycleRecompute(businessId);
    return location;
  }

  /**
   * Update business location fields.
   * Note: commission is controlled by Business.accountType and cannot be set here.
   * Address updates go through the addresses API.
   */
  async updateBusinessLocation(
    businessId: string,
    locationId: string,
    data: {
      name?: string;
      phone?: string;
      mobile_payment_phone_id?: string | null;
      email?: string;
      location_type?: 'store' | 'warehouse' | 'office' | 'pickup_point';
      is_active?: boolean;
      is_primary?: boolean;
      auto_withdraw_commissions?: boolean;
      logo_url?: string | null;
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
    const setInput: Record<string, unknown> = { ...data };
    if (setInput.logo_url === '') {
      setInput.logo_url = null;
    }
    delete setInput.rendasua_item_commission_percentage;
    if (
      data.mobile_payment_phone_id !== undefined ||
      data.phone !== undefined
    ) {
      const phoneFields = await this.resolveLocationPhoneFields(
        businessId,
        data.mobile_payment_phone_id,
        data.phone
      );
      setInput.phone = phoneFields.phone;
      setInput.mobile_payment_phone_id = phoneFields.mobilePaymentPhoneId;
    }

    const updateMutation = `
      mutation UpdateBusinessLocation($id: uuid!, $data: business_locations_set_input!) {
        update_business_locations_by_pk(pk_columns: { id: $id }, _set: $data) {
          id
          name
          phone
          mobile_payment_phone_id
          email
          auto_withdraw_commissions
          logo_url
          location_type
          is_active
          is_primary
          mobile_payment_phone {
            id phone_e164 is_verified verified_at
          }
          address { id address_line_1 address_line_2 city state postal_code country }
        }
      }
    `;
    const result = await this.hasuraUserService.executeMutation(updateMutation, {
      id: locationId,
      data: setInput,
    });
    if (
      data.is_primary !== undefined ||
      data.is_active !== undefined
    ) {
      // Primary/active flips can change the resolved payment rail for visibility.
      this.triggerLifecycleRecompute(businessId);
    }
    return result?.update_business_locations_by_pk ?? null;
  }

  private async resolveLocationPhoneFields(
    businessId: string,
    mobilePaymentPhoneId?: string | null,
    legacyPhone?: string
  ): Promise<{ phone: string | null; mobilePaymentPhoneId: string | null }> {
    if (mobilePaymentPhoneId) {
      const bizUser = await this.hasuraSystemService.executeQuery(
        `query BizUser($businessId: uuid!) {
          businesses_by_pk(id: $businessId) { user_id }
        }`,
        { businessId }
      );
      const userId = bizUser.businesses_by_pk?.user_id;
      const phoneRow = await this.hasuraSystemService.executeQuery(
        `query RegPhone($id: uuid!, $userId: uuid!) {
          user_mobile_payment_phones(
            where: { id: { _eq: $id }, user_id: { _eq: $userId } }
            limit: 1
          ) { id phone_e164 }
        }`,
        { id: mobilePaymentPhoneId, userId }
      );
      const reg = phoneRow.user_mobile_payment_phones?.[0];
      if (!reg) {
        throw new HttpException(
          { success: false, error: 'Invalid mobile payment phone for this business' },
          HttpStatus.BAD_REQUEST
        );
      }
      return {
        phone: reg.phone_e164,
        mobilePaymentPhoneId: reg.id,
      };
    }
    if (legacyPhone !== undefined) {
      return {
        phone: legacyPhone?.trim() ? legacyPhone.trim() : null,
        mobilePaymentPhoneId: null,
      };
    }
    return { phone: null, mobilePaymentPhoneId: null };
  }

  /**
   * Delete a business location when it has no inventory.
   * Hard-deletes when no order history; otherwise soft-deletes.
   * Rejects primary, only-active, and locations with assigned items.
   */
  async deleteBusinessLocation(
    businessId: string,
    locationId: string
  ): Promise<{ success: boolean; message: string }> {
    const location = await this.getOwnedLocationForDelete(businessId, locationId);
    await this.assertLocationDeletable(businessId, location);
    const orderCount = await this.countLocationOrders(locationId);
    if (orderCount > 0) {
      await this.softDeleteBusinessLocation(locationId);
    } else {
      await this.prepareLocationAccountsForHardDelete(locationId);
      await this.hardDeleteBusinessLocation(locationId);
    }
    return {
      success: true,
      message: 'Business location deleted successfully',
    };
  }

  private async softDeleteBusinessLocation(locationId: string): Promise<void> {
    await this.hasuraUserService.executeMutation(
      `
      mutation SoftDeleteLocation($locationId: uuid!) {
        update_business_locations_by_pk(
          pk_columns: { id: $locationId },
          _set: { is_active: false }
        ) { id is_active }
      }
    `,
      { locationId }
    );
  }

  /**
   * Location accounts use ON DELETE SET NULL, which collides with the legacy
   * unique (user_id, currency) index when a null-location account already exists.
   * Remove empty location accounts first; block if any still have balance.
   */
  private async prepareLocationAccountsForHardDelete(
    locationId: string
  ): Promise<void> {
    const accounts = await this.getLocationAccounts(locationId);
    if (accounts.some((a) => this.accountHasBalance(a))) {
      throw new HttpException(
        {
          success: false,
          error:
            'Cannot delete a location that still has account balance. Withdraw or transfer funds first.',
          code: 'LOCATION_HAS_BALANCE',
        },
        HttpStatus.CONFLICT
      );
    }
    if (!accounts.length) return;
    await this.hasuraSystemService.executeMutation(
      `
      mutation DeleteLocationAccounts($locationId: uuid!) {
        delete_accounts(where: { business_location_id: { _eq: $locationId } }) {
          affected_rows
        }
      }
    `,
      { locationId }
    );
  }

  private async getLocationAccounts(locationId: string) {
    const result = await this.hasuraSystemService.executeQuery<{
      accounts: Array<{
        id: string;
        available_balance: number | string;
        withheld_balance: number | string;
      }>;
    }>(
      `
      query LocationAccounts($locationId: uuid!) {
        accounts(where: { business_location_id: { _eq: $locationId } }) {
          id
          available_balance
          withheld_balance
        }
      }
    `,
      { locationId }
    );
    return result.accounts ?? [];
  }

  private accountHasBalance(account: {
    available_balance: number | string;
    withheld_balance: number | string;
  }): boolean {
    return (
      Number(account.available_balance) !== 0 ||
      Number(account.withheld_balance) !== 0
    );
  }

  private async hardDeleteBusinessLocation(locationId: string): Promise<void> {
    await this.hasuraUserService.executeMutation(
      `
      mutation HardDeleteLocation($locationId: uuid!) {
        delete_business_locations_by_pk(id: $locationId) { id }
      }
    `,
      { locationId }
    );
  }

  private async getOwnedLocationForDelete(
    businessId: string,
    locationId: string
  ) {
    const result = await this.hasuraUserService.executeQuery<{
      business_locations_by_pk: {
        id: string;
        business_id: string;
        is_primary: boolean;
      } | null;
    }>(
      `
      query GetLocationForDelete($locationId: uuid!) {
        business_locations_by_pk(id: $locationId) {
          id
          business_id
          is_primary
        }
      }
    `,
      { locationId }
    );
    const location = result.business_locations_by_pk;
    if (!location || location.business_id !== businessId) {
      throw new HttpException(
        {
          success: false,
          error: 'Business location not found or access denied',
        },
        HttpStatus.NOT_FOUND
      );
    }
    return location;
  }

  private async assertLocationDeletable(
    businessId: string,
    location: { id: string; is_primary: boolean }
  ): Promise<void> {
    const activeCount = await this.countActiveBusinessLocations(businessId);
    if (activeCount === 1) {
      throw new HttpException(
        {
          success: false,
          error:
            'Cannot delete the only location. Each business must have at least one location.',
          code: 'ADDRESS_MINIMUM_REQUIRED',
        },
        HttpStatus.CONFLICT
      );
    }
    if (location.is_primary) {
      throw new HttpException(
        {
          success: false,
          error:
            'Cannot delete the primary location. Please set another location as primary first.',
          code: 'ADDRESS_PRIMARY_DELETE_FORBIDDEN',
        },
        HttpStatus.CONFLICT
      );
    }
    const inventoryCount = await this.countLocationInventory(location.id);
    if (inventoryCount > 0) {
      throw new HttpException(
        {
          success: false,
          error:
            'Cannot delete a location that still has items. Remove items from this location first.',
          code: 'LOCATION_HAS_INVENTORY',
        },
        HttpStatus.CONFLICT
      );
    }
  }

  private async countActiveBusinessLocations(
    businessId: string
  ): Promise<number> {
    const result = await this.hasuraUserService.executeQuery<{
      business_locations: Array<{ id: string }>;
    }>(
      `
      query ListActiveLocations($businessId: uuid!) {
        business_locations(
          where: { business_id: { _eq: $businessId }, is_active: { _eq: true } }
        ) { id }
      }
    `,
      { businessId }
    );
    return result.business_locations?.length ?? 0;
  }

  private async countLocationInventory(locationId: string): Promise<number> {
    const result = await this.hasuraUserService.executeQuery<{
      business_inventory: Array<{ id: string }>;
    }>(
      `
      query ListLocationInventory($locationId: uuid!) {
        business_inventory(
          where: { business_location_id: { _eq: $locationId } }
          limit: 1
        ) { id }
      }
    `,
      { locationId }
    );
    return result.business_inventory?.length ?? 0;
  }

  private async countLocationOrders(locationId: string): Promise<number> {
    const result = await this.hasuraUserService.executeQuery<{
      orders: Array<{ id: string }>;
    }>(
      `
      query ListLocationOrders($locationId: uuid!) {
        orders(
          where: { business_location_id: { _eq: $locationId } }
          limit: 1
        ) { id }
      }
    `,
      { locationId }
    );
    return result.orders?.length ?? 0;
  }

  async getSingleItem(businessId: string, itemId: string) {
    const result = await this.hasuraUserService.executeQuery<{
      items_by_pk: any | null;
    }>(GET_SINGLE_ITEM, { id: itemId });
    const item = result.items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new Error('Item not found or does not belong to this business');
    }
    if (item.moderation_status !== 'rejected') {
      return { ...item, rejection_reason: null };
    }
    const rejection_reason = await resolveSaleItemRejectionReason(
      this.hasuraSystemService,
      itemId
    );
    return { ...item, rejection_reason };
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
    const [rawItems, business_locations, available_items, favoriteIds] =
      await Promise.all([
        this.getItems(businessId),
        this.getBusinessLocations(businessId),
        this.getAvailableItems(),
        this.getFavoriteItemIds(businessId),
      ]);
    const items = rawItems.map((it: { id: string }) => ({
      ...it,
      is_favorite: favoriteIds.has(it.id),
    }));
    return { items, business_locations, available_items };
  }

  async getFavoriteItemIds(businessId: string): Promise<Set<string>> {
    const result = await this.hasuraSystemService.executeQuery<{
      business_item_favorites: { item_id: string }[];
    }>(GET_FAVORITE_ITEM_IDS, { businessId });
    return new Set(
      (result.business_item_favorites ?? []).map((r) => r.item_id)
    );
  }

  async setItemFavorite(
    businessId: string,
    itemId: string,
    favorited: boolean
  ): Promise<void> {
    const check = await this.hasuraSystemService.executeQuery<{
      items_by_pk: { id: string; business_id: string } | null;
    }>(GET_ITEM_BUSINESS, { id: itemId });
    if (!check.items_by_pk || check.items_by_pk.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
    if (favorited) {
      await this.hasuraSystemService.executeMutation(DELETE_ITEM_FAVORITE, {
        businessId,
        itemId,
      });
      await this.hasuraSystemService.executeMutation(INSERT_ITEM_FAVORITE, {
        businessId,
        itemId,
      });
    } else {
      await this.hasuraSystemService.executeMutation(DELETE_ITEM_FAVORITE, {
        businessId,
        itemId,
      });
    }
  }

  async getBusinessInventory(businessId: string) {
    const result =
      await this.hasuraUserService.executeQuery<{
        business_inventory: any[];
      }>(GET_BUSINESS_INVENTORY, { businessId });
    return result.business_inventory ?? [];
  }

  /**
   * Upsert/clear per-location variant price overrides for an inventory row.
   * Pass selling_price: null to delete an override (inherit variant/inventory price).
   */
  async bulkSetVariantPriceOverrides(
    businessId: string,
    inventoryId: string,
    overrides: Array<{ item_variant_id: string; selling_price: number | null }>
  ) {
    const inv = await this.getOwnedInventoryRow(businessId, inventoryId);
    const itemId = inv.item_id as string;
    const results: Array<{
      item_variant_id: string;
      selling_price: number | null;
    }> = [];

    for (const entry of overrides) {
      await this.assertVariantBelongsToItem(entry.item_variant_id, itemId);
      if (entry.selling_price == null) {
        await this.deleteVariantPriceOverride(
          inventoryId,
          entry.item_variant_id
        );
        results.push({
          item_variant_id: entry.item_variant_id,
          selling_price: null,
        });
        continue;
      }
      await this.upsertVariantPriceOverride(
        inventoryId,
        entry.item_variant_id,
        entry.selling_price
      );
      results.push({
        item_variant_id: entry.item_variant_id,
        selling_price: entry.selling_price,
      });
    }
    return { inventory_id: inventoryId, overrides: results };
  }

  private async getOwnedInventoryRow(businessId: string, inventoryId: string) {
    const invResult = await this.hasuraUserService.executeQuery<{
      business_inventory_by_pk: {
        id: string;
        item_id: string;
        business_location: { business_id: string };
      } | null;
    }>(
      `
      query GetInventoryOwned($id: uuid!) {
        business_inventory_by_pk(id: $id) {
          id
          item_id
          business_location { business_id }
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
    return inv;
  }

  private async assertVariantBelongsToItem(
    variantId: string,
    itemId: string
  ): Promise<void> {
    const res = await this.hasuraUserService.executeQuery<{
      item_variants_by_pk: { id: string; item_id: string } | null;
    }>(
      `
      query VariantItem($id: uuid!) {
        item_variants_by_pk(id: $id) { id item_id }
      }
    `,
      { id: variantId }
    );
    const v = res.item_variants_by_pk;
    if (!v || v.item_id !== itemId) {
      throw new HttpException(
        {
          success: false,
          error: 'Variant does not belong to this inventory item',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async upsertVariantPriceOverride(
    inventoryId: string,
    variantId: string,
    sellingPrice: number
  ): Promise<void> {
    await this.hasuraUserService.executeMutation(
      `
      mutation UpsertVariantPriceOverride(
        $inventoryId: uuid!
        $variantId: uuid!
        $price: numeric!
      ) {
        insert_business_inventory_variant_price_overrides_one(
          object: {
            business_inventory_id: $inventoryId
            item_variant_id: $variantId
            selling_price: $price
          }
          on_conflict: {
            constraint: uq_bivpo_inventory_variant
            update_columns: [selling_price, updated_at]
          }
        ) { id }
      }
    `,
      {
        inventoryId,
        variantId,
        price: sellingPrice,
      }
    );
  }

  private async deleteVariantPriceOverride(
    inventoryId: string,
    variantId: string
  ): Promise<void> {
    await this.hasuraUserService.executeMutation(
      `
      mutation DeleteVariantPriceOverride($inventoryId: uuid!, $variantId: uuid!) {
        delete_business_inventory_variant_price_overrides(
          where: {
            business_inventory_id: { _eq: $inventoryId }
            item_variant_id: { _eq: $variantId }
          }
        ) { affected_rows }
      }
    `,
      { inventoryId, variantId }
    );
  }

  /**
   * Unassign an item from a business location by deleting the inventory row.
   * Blocked when reserved stock or order history references the row.
   */
  async deleteInventoryItem(
    businessId: string,
    inventoryId: string
  ): Promise<void> {
    const inv = await this.getInventoryForDelete(businessId, inventoryId);
    this.assertInventoryDeletable(inv);
    await this.hasuraUserService.executeMutation(DELETE_BUSINESS_INVENTORY_BY_PK, {
      id: inventoryId,
    });
    this.triggerLifecycleRecompute(businessId);
  }

  private async getInventoryForDelete(businessId: string, inventoryId: string) {
    const invResult = await this.hasuraUserService.executeQuery<{
      business_inventory_by_pk: {
        id: string;
        reserved_quantity: number;
        business_location: { business_id: string };
        order_items: Array<{ id: string }>;
      } | null;
    }>(
      `
      query GetInventoryForDelete($id: uuid!) {
        business_inventory_by_pk(id: $id) {
          id
          reserved_quantity
          business_location { business_id }
          order_items(limit: 1) { id }
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
    return inv;
  }

  private assertInventoryDeletable(inv: {
    reserved_quantity: number;
    order_items: Array<{ id: string }>;
  }): void {
    if ((inv.reserved_quantity ?? 0) > 0) {
      throw new HttpException(
        {
          success: false,
          error:
            'Cannot remove inventory with reserved stock. Complete or cancel reserved orders first.',
        },
        HttpStatus.CONFLICT
      );
    }
    if ((inv.order_items?.length ?? 0) > 0) {
      throw new HttpException(
        {
          success: false,
          error:
            'Cannot remove inventory linked to past orders. Deactivate it instead.',
        },
        HttpStatus.CONFLICT
      );
    }
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
      promotion?: Record<string, unknown> | null;
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

    const updated = result.update_business_inventory_by_pk;
    this.triggerLifecycleRecompute(businessId);
    return updated;
  }

  async createInventoryItem(
    businessId: string,
    data: {
      business_location_id: string;
      item_id: string;
      item_variant_id?: string | null;
      quantity: number;
      reserved_quantity: number;
      reorder_point: number;
      reorder_quantity: number;
      unit_cost: number;
      selling_price: number;
      is_active: boolean;
    }
  ) {
    const locRow = await this.hasuraUserService.executeQuery<{
      business_locations_by_pk: { id: string; business_id: string } | null;
    }>(
      `
      query GetLocationBusiness($locationId: uuid!) {
        business_locations_by_pk(id: $locationId) {
          id
          business_id
        }
      }
    `,
      { locationId: data.business_location_id }
    );
    const loc = locRow?.business_locations_by_pk;
    if (!loc || loc.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Location not found or access denied' },
        HttpStatus.NOT_FOUND
      );
    }

    const itemRow = await this.hasuraUserService.executeQuery<{
      items_by_pk: {
        id: string;
        business_id: string;
        item_sub_category?: {
          item_category?: { name?: string | null } | null;
        } | null;
      } | null;
    }>(GET_ITEM_BY_ID, { itemId: data.item_id });
    const item = itemRow.items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
    const quantity = resolveInitialInventoryQuantity({
      requestedQuantity: data.quantity,
      categoryName: item.item_sub_category?.item_category?.name,
    });

    if (data.item_variant_id) {
      const variantRow = await this.hasuraUserService.executeQuery<{
        item_variants_by_pk: { id: string; item_id: string } | null;
      }>(
        `
        query ($id: uuid!) {
          item_variants_by_pk(id: $id) { id item_id }
        }
      `,
        { id: data.item_variant_id }
      );
      const variant = variantRow.item_variants_by_pk;
      if (!variant || variant.item_id !== data.item_id) {
        throw new HttpException(
          { success: false, error: 'Variant not found for item' },
          HttpStatus.BAD_REQUEST
        );
      }
    }

    const result = await this.hasuraUserService.executeMutation<{
      insert_business_inventory_one: {
        id: string;
        item_id: string;
        business_location_id: string;
        item_variant_id?: string | null;
      } | null;
    }>(INSERT_BUSINESS_INVENTORY, {
      itemData: {
        business_location_id: data.business_location_id,
        item_id: data.item_id,
        item_variant_id: data.item_variant_id ?? null,
        quantity,
        reserved_quantity: data.reserved_quantity,
        reorder_point: data.reorder_point,
        reorder_quantity: data.reorder_quantity,
        unit_cost: data.unit_cost,
        selling_price: data.selling_price,
        is_active: data.is_active,
      },
    });

    const created = result?.insert_business_inventory_one;
    if (!created?.id) {
      throw new HttpException(
        { success: false, error: 'Failed to create inventory' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    this.triggerLifecycleRecompute(businessId);
    return created;
  }

  private promotionPayloadFromDto(
    dto: UpdateItemPromotionDto
  ): Record<string, unknown> | null {
    if (!dto.promoted) return null;
    const p: Record<string, unknown> = { promoted: true };
    if (dto.start) p.start = dto.start;
    if (dto.end) p.end = dto.end;
    if (dto.sponsored === true) p.sponsored = true;
    return p;
  }

  async setPromotionForItem(
    businessId: string,
    itemId: string,
    dto: UpdateItemPromotionDto
  ): Promise<{ affected_rows: number }> {
    const row = await this.hasuraUserService.executeQuery<{
      items_by_pk: { id: string; business_id: string } | null;
    }>(GET_ITEM_BY_ID, { itemId });
    const item = row.items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
    const promotion = this.promotionPayloadFromDto(dto);
    const result = await this.hasuraUserService.executeMutation<{
      update_business_inventory: { affected_rows: number };
    }>(UPDATE_BUSINESS_INVENTORY_PROMOTION_BULK, {
      businessId,
      itemId,
      promotion,
    });
    return {
      affected_rows: result.update_business_inventory?.affected_rows ?? 0,
    };
  }

  async createItem(
    businessId: string,
    input: ItemsInsertInput | CreateItemDto
  ): Promise<Record<string, unknown>> {
    const withDefaults = await this.withPayOnDeliveryDefault(
      businessId,
      input as ItemsInsertInput
    );
    await this.assertOfflinePaymentAllowed(businessId, withDefaults);
    const taxCodeInput =
      typeof withDefaults.stripe_tax_code_id === 'string'
        ? withDefaults.stripe_tax_code_id
        : undefined;
    let stripe_tax_code_id: string;
    try {
      stripe_tax_code_id = await this.stripeTaxCodesService.validateTaxCodeId(
        taxCodeInput
      );
    } catch (error: any) {
      throw new HttpException(
        { success: false, message: error?.message || 'Invalid tax category' },
        HttpStatus.BAD_REQUEST
      );
    }
    const currency =
      await this.hasuraSystemService.resolveBusinessCurrency(businessId);
    const created = await this.itemsService.createItem(businessId, {
      ...withDefaults,
      currency,
      stripe_tax_code_id,
      // Starts as draft; publish submits for moderation. DB default is draft.
      is_active: false,
    });
    this.triggerLifecycleRecompute(businessId);
    return created;
  }

  async publishBusinessItem(
    businessId: string,
    itemId: string
  ): Promise<{ id: string; moderation_status: string }> {
    const item = await this.loadItemModerationRow(businessId, itemId);
    if (item.moderation_status !== 'draft') {
      // Idempotent: retries after a successful submit (or double-tap) should not fail.
      if (this.isAlreadySubmittedForModeration(item.moderation_status)) {
        return {
          id: item.id,
          moderation_status: item.moderation_status,
        };
      }
      throw new HttpException(
        'Only draft items can be published',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.assertItemHasPublishablePrice(businessId, itemId);
    const result = await this.hasuraSystemService.executeMutation<{
      update_items: {
        affected_rows: number;
        returning: Array<{ id: string; moderation_status: string }>;
      };
    }>(PUBLISH_ITEM_FROM_DRAFT, { id: itemId });
    const row = result.update_items?.returning?.[0];
    if (!row || result.update_items.affected_rows < 1) {
      // Lost the race to another publish — treat submitted state as success.
      const again = await this.loadItemModerationRow(businessId, itemId);
      if (this.isAlreadySubmittedForModeration(again.moderation_status)) {
        return {
          id: again.id,
          moderation_status: again.moderation_status,
        };
      }
      throw new HttpException(
        'Failed to publish item',
        HttpStatus.BAD_REQUEST
      );
    }
    void this.itemAiReviewService.requestReview(itemId);
    return row;
  }

  private async assertItemHasPublishablePrice(
    businessId: string,
    itemId: string
  ): Promise<void> {
    const itemRow = await this.hasuraSystemService.executeQuery<{
      items_by_pk: { id: string; business_id: string; price: number | null } | null;
    }>(GET_ITEM_BY_ID, { itemId });
    const item = itemRow.items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
    if (item.price == null || Number.isNaN(item.price) || item.price <= 0) {
      throw new HttpException(
        {
          success: false,
          error: 'PRICE_REQUIRED',
          message: 'A valid price is required before publishing',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Create inventory with sane defaults and publish the draft in one call.
   */
  async quickPublishBusinessItem(
    businessId: string,
    itemId: string,
    input: {
      locationId: string;
      quantity?: number;
      sellingPrice?: number;
    }
  ): Promise<{
    item: { id: string; moderation_status: string };
    inventory: { id: string };
  }> {
    const itemRow = await this.hasuraSystemService.executeQuery<{
      items_by_pk: {
        id: string;
        business_id: string;
        price: number | null;
        moderation_status: string;
      } | null;
    }>(GET_ITEM_BY_ID, { itemId });
    const item = itemRow.items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
    if (
      item.moderation_status !== 'draft' &&
      !this.isAlreadySubmittedForModeration(item.moderation_status)
    ) {
      throw new HttpException(
        'Only draft items can be published',
        HttpStatus.BAD_REQUEST
      );
    }

    const quantity =
      input.quantity != null && !Number.isNaN(input.quantity)
        ? Math.max(0, Math.floor(input.quantity))
        : 1;
    const sellingPrice =
      input.sellingPrice != null && !Number.isNaN(input.sellingPrice)
        ? input.sellingPrice
        : item.price;
    if (sellingPrice == null || Number.isNaN(sellingPrice) || sellingPrice <= 0) {
      throw new HttpException(
        {
          success: false,
          error: 'PRICE_REQUIRED',
          message: 'A valid price is required before publishing',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    if (
      item.moderation_status === 'draft' &&
      input.sellingPrice != null &&
      !Number.isNaN(input.sellingPrice) &&
      input.sellingPrice !== item.price
    ) {
      await this.updateItem(businessId, itemId, {
        price: input.sellingPrice,
      });
    }

    const inventoryId = await this.ensureInventoryForQuickPublish(
      businessId,
      itemId,
      input.locationId,
      quantity,
      sellingPrice,
      item.moderation_status
    );

    const published = await this.publishBusinessItem(businessId, itemId);
    return {
      item: published,
      inventory: { id: inventoryId },
    };
  }

  private async ensureInventoryForQuickPublish(
    businessId: string,
    itemId: string,
    locationId: string,
    quantity: number,
    sellingPrice: number,
    moderationStatus: string
  ): Promise<string> {
    const existing = await this.hasuraUserService.executeQuery<{
      business_inventory: { id: string }[];
    }>(
      `
      query FindInventory($itemId: uuid!, $locationId: uuid!) {
        business_inventory(
          where: {
            item_id: { _eq: $itemId }
            business_location_id: { _eq: $locationId }
            item_variant_id: { _is_null: true }
          }
          limit: 1
        ) {
          id
        }
      }
    `,
      { itemId, locationId }
    );
    const existingId = existing.business_inventory?.[0]?.id;
    if (existingId) {
      // Idempotent re-publish of already-submitted items must not clobber live stock/pricing.
      if (!this.isAlreadySubmittedForModeration(moderationStatus)) {
        await this.updateInventoryItem(businessId, existingId, {
          quantity,
          unit_cost: sellingPrice,
          selling_price: sellingPrice,
          is_active: true,
        });
      }
      return existingId;
    }
    const created = await this.createInventoryItem(businessId, {
      business_location_id: locationId,
      item_id: itemId,
      quantity,
      reserved_quantity: 0,
      reorder_point: 0,
      reorder_quantity: 0,
      unit_cost: sellingPrice,
      selling_price: sellingPrice,
      is_active: true,
    });
    return created.id;
  }

  async updateItem(
    businessId: string,
    itemId: string,
    updates: UpdateItemDto
  ) {
    return this.applyItemUpdateWithGuards(businessId, itemId, updates, false);
  }

  /** Platform admin update — same business validations, system-scoped item write. */
  async adminUpdateItem(itemId: string, updates: UpdateItemDto) {
    const existing = await this.loadItemByIdForAdmin(itemId);
    const { status: _ignoredStatus, ...safeUpdates } = updates as UpdateItemDto & {
      status?: unknown;
    };
    return this.applyItemUpdateWithGuards(
      existing.business_id,
      itemId,
      safeUpdates,
      true
    );
  }

  private async applyItemUpdateWithGuards(
    businessId: string,
    itemId: string,
    updates: UpdateItemDto,
    asAdmin: boolean
  ) {
    await this.assertOfflinePaymentAllowed(businessId, updates);
    const existing = await this.loadItemModerationRow(businessId, itemId);
    const wasRejected = existing.moderation_status === 'rejected';
    const payload = await this.buildUpdatePayload(businessId, updates);
    const updated = asAdmin
      ? await this.itemsService.adminUpdateItem(itemId, payload)
      : await this.itemsService.updateItem(businessId, itemId, payload);
    const contentKeys = Object.keys(updates).filter((k) => k !== 'is_active');
    if (wasRejected && contentKeys.length > 0) {
      await this.resetRejectedItemToPendingModeration(itemId);
    }
    this.triggerLifecycleRecompute(businessId);
    return updated;
  }

  private async buildUpdatePayload(
    businessId: string,
    updates: UpdateItemDto
  ): Promise<UpdateItemDto> {
    const { categoryName, subCategoryName, brandName, ...rest } = updates;
    const payload: UpdateItemDto = { ...rest };
    if (
      categoryName?.trim() &&
      subCategoryName?.trim() &&
      payload.item_sub_category_id == null
    ) {
      payload.item_sub_category_id = await this.ensureSubCategoryId(
        categoryName.trim(),
        subCategoryName.trim()
      );
    }
    if (brandName?.trim() && payload.brand_id === undefined) {
      payload.brand_id = await this.ensureBrandId(brandName.trim());
    }
    if (updates.currency !== undefined || updates.price !== undefined) {
      payload.currency =
        await this.hasuraSystemService.resolveBusinessCurrency(businessId);
    }
    if (updates.stripe_tax_code_id !== undefined) {
      payload.stripe_tax_code_id = await this.validateStripeTaxCodeId(
        updates.stripe_tax_code_id
      );
    }
    return payload;
  }

  private async validateStripeTaxCodeId(taxCodeId: string): Promise<string> {
    try {
      return await this.stripeTaxCodesService.validateTaxCodeId(taxCodeId);
    } catch (error: any) {
      throw new HttpException(
        { success: false, message: error?.message || 'Invalid tax category' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async loadItemByIdForAdmin(itemId: string): Promise<{
    id: string;
    business_id: string;
    moderation_status: string;
    status: string;
  }> {
    const result = await this.hasuraSystemService.executeQuery<{
      items_by_pk: {
        id: string;
        business_id: string;
        moderation_status: string;
        status: string;
      } | null;
    }>(GET_ITEM_MODERATION_ROW, { itemId });
    const item = result.items_by_pk;
    if (!item || item.status !== 'active') {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return item;
  }

  private async loadItemModerationRow(
    businessId: string,
    itemId: string
  ): Promise<{
    id: string;
    business_id: string;
    moderation_status: string;
    name: string;
    description: string | null;
    status: string;
  }> {
    const result = await this.hasuraSystemService.executeQuery<{
      items_by_pk: {
        id: string;
        business_id: string;
        moderation_status: string;
        name: string;
        description: string | null;
        status: string;
      } | null;
    }>(GET_ITEM_MODERATION_ROW, { itemId });
    const item = result.items_by_pk;
    if (!item || item.business_id !== businessId || item.status !== 'active') {
      throw new HttpException(
        { success: false, error: 'Item not found or not owned by business' },
        HttpStatus.NOT_FOUND
      );
    }
    return item;
  }

  private isAlreadySubmittedForModeration(status: string): boolean {
    return (
      status === 'pending' ||
      status === 'ai_reviewing' ||
      status === 'approved' ||
      status === 'proposal_pending'
    );
  }

  private async resetRejectedItemToPendingModeration(
    itemId: string
  ): Promise<void> {
    const result = await this.hasuraSystemService.executeMutation<{
      update_items_by_pk: { id: string } | null;
    }>(RESET_ITEM_MODERATION_PENDING, { id: itemId });
    if (!result.update_items_by_pk) {
      throw new HttpException(
        'Failed to resubmit item for review',
        HttpStatus.BAD_REQUEST
      );
    }
    void this.itemAiReviewService.requestReview(itemId);
  }

  /** CSV rows: publish drafts into the moderation queue; resubmit rejected after image fixes. */
  private async ensureCsvItemSubmittedForReview(
    businessId: string,
    itemId: string
  ): Promise<void> {
    const item = await this.loadItemModerationRow(businessId, itemId);
    if (item.moderation_status === 'draft') {
      await this.publishBusinessItem(businessId, itemId);
      return;
    }
    if (item.moderation_status === 'rejected') {
      await this.itemAiReviewService.resubmitIfRejected(itemId);
    }
  }

  /**
   * Replace item tags with the given names (find-or-create tags).
   */
  async setItemTags(
    businessId: string,
    itemId: string,
    tagNames: string[]
  ): Promise<{ tags: string[] }> {
    const itemResult = await this.hasuraUserService.executeQuery<{
      items_by_pk: { id: string; business_id: string } | null;
    }>(GET_ITEM_BY_ID, { itemId });
    const item = itemResult?.items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }

    const cleaned = [
      ...new Set(
        tagNames
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
      ),
    ].slice(0, 20);

    await this.hasuraSystemService.executeMutation(
      `
      mutation ClearItemTags($itemId: uuid!) {
        delete_item_tags(where: { item_id: { _eq: $itemId } }) {
          affected_rows
        }
      }
    `,
      { itemId }
    );

    if (cleaned.length === 0) {
      return { tags: [] };
    }

    const tagIds: string[] = [];
    for (const name of cleaned) {
      const found = await this.hasuraSystemService.executeQuery<{
        tags: { id: string }[];
      }>(
        `
        query FindTag($name: String!) {
          tags(where: { name: { _ilike: $name } }, limit: 1) {
            id
          }
        }
      `,
        { name }
      );
      let tagId: string | undefined = found.tags?.[0]?.id;
      if (!tagId) {
        const inserted = await this.hasuraSystemService.executeMutation<{
          insert_tags_one: { id: string } | null;
        }>(
          `
          mutation InsertTag($name: String!) {
            insert_tags_one(object: { name: $name }) {
              id
            }
          }
        `,
          { name }
        );
        tagId = inserted.insert_tags_one?.id ?? undefined;
      }
      if (tagId) {
        tagIds.push(tagId);
      }
    }

    if (tagIds.length) {
      await this.hasuraSystemService.executeMutation(
        `
        mutation LinkItemTags($objects: [item_tags_insert_input!]!) {
          insert_item_tags(
            objects: $objects
            on_conflict: {
              constraint: item_tags_pkey
              update_columns: []
            }
          ) {
            affected_rows
          }
        }
      `,
        {
          objects: tagIds.map((tag_id) => ({ item_id: itemId, tag_id })),
        }
      );
    }

    return { tags: cleaned };
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
    this.triggerLifecycleRecompute(businessId);
  }

  async processCsvRows(
    businessId: string,
    userId: string,
    rows: CsvItemRowDto[],
    rowOffset = 0
  ): Promise<CsvUploadResultDto> {
    this.logger.log(`CSV upload: starting for businessId=${businessId} rows=${rows.length} rowOffset=${rowOffset}`);
    const [items, locations, inventory, validSubCategoryIds, lockedCurrency, rail] =
      await Promise.all([
        this.getItems(businessId),
        this.getBusinessLocations(businessId),
        this.getBusinessInventory(businessId),
        this.getItemSubCategoryIds(),
        this.hasuraSystemService.resolveBusinessCurrency(businessId),
        this.paymentRoutingService.resolveRailForBusiness(businessId),
      ]);
    const defaultPayOnDelivery = resolvePayOnDeliveryDefault(rail);

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
            currency: lockedCurrency,
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
            // Preserve already-approved live items; all other rows stay inactive
            // until moderation approves them.
            is_active: this.getCsvItemActiveStateForUpdate(existingItem),
            brand_id: row.brand_id,
          };
          await this.updateItem(businessId, existingItem.id, itemData);
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
            stripe_tax_code_id: STRIPE_TAX_CODE_GENERAL_TANGIBLE,
            price: row.price,
            currency: lockedCurrency,
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
            pay_on_delivery_enabled: defaultPayOnDelivery,
            // New items start inactive until moderation approves them
            is_active: false,
            brand_id: row.brand_id,
          };
          const newItem = await this.itemsService.createItem(
            businessId,
            insertData as ItemsInsertInput
          );
          itemId = newItem.id as string;
          if (!itemId) {
            throw new Error('Failed to create item');
          }
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
            const insertedImage = await this.hasuraUserService.executeMutation<{
              insert_item_images_one: { id: string } | null;
            }>(INSERT_ITEM_IMAGE, {
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
            const newImageId = insertedImage?.insert_item_images_one?.id;
            if (newImageId) {
              void this.imageThumbnailsService.enqueueGeneration(
                'item_image',
                newImageId
              );
            }
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

        await this.ensureCsvItemSubmittedForReview(businessId, itemId);
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
    if (insertedCount > 0 || updatedCount > 0) {
      this.triggerLifecycleRecompute(businessId);
    }
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
    // Idempotent: resume an existing draft linked to this image (eager create race).
    if (image.item_id) {
      const existing = await this.hasuraSystemService.executeQuery<{
        items_by_pk: {
          id: string;
          name: string;
          sku: string | null;
          business_id: string;
          moderation_status: string;
        } | null;
      }>(GET_ITEM_BY_ID, { itemId: image.item_id });
      const row = existing.items_by_pk;
      if (row && row.business_id === businessId) {
        // Only resume drafts. A linked non-draft means this photo was already
        // submitted — return it so quick-publish can complete idempotently.
        return {
          id: row.id,
          name: row.name,
          sku: row.sku,
          moderation_status: row.moderation_status,
        };
      }
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

    const name = (dto.name?.trim() || 'Untitled product').trim();
    const baseSku = this.buildSkuBase(name);
    const sku = await this.generateUniqueSku(businessId, baseSku);

    const hasPrice = dto.price != null && !Number.isNaN(dto.price as number);
    const price = hasPrice ? (dto.price as number) : undefined;
    // Always lock currency to the business even when price is still unset.
    const currency = await this.hasuraSystemService.resolveBusinessCurrency(
      businessId
    );

    const categoryName = dto.categoryName?.trim();
    const subCategoryName = dto.subCategoryName?.trim();
    const brandName = dto.brandName?.trim();

    // items.item_sub_category_id is NOT NULL — eager drafts without a known
    // category fall back to "Other" until the merchant/AI sets the real one.
    const subCategoryId =
      categoryName && subCategoryName
        ? await this.ensureSubCategoryId(categoryName, subCategoryName)
        : await this.ensureSubCategoryId(
            DEFAULT_DRAFT_CATEGORY_NAME,
            DEFAULT_DRAFT_SUB_CATEGORY_NAME
          );

    const brandId = brandName
      ? await this.ensureBrandId(brandName)
      : null;

    const insertData = await this.withPayOnDeliveryDefault(businessId, {
      business_id: businessId,
      name,
      description: generatedDescription,
      sku,
      item_sub_category_id: subCategoryId,
      ...(brandId && { brand_id: brandId }),
      ...(hasPrice && { price }),
      currency,
      min_order_quantity: 1,
      max_order_quantity: 10,
      is_active: false,
      ...(typeof dto.is_used === 'boolean' && { is_used: dto.is_used }),
      ...(dto.dimensions?.trim() && { dimensions: dto.dimensions.trim() }),
    });

    const newItem = await this.itemsService.createItem(
      businessId,
      insertData
    );
    const newItemId = newItem.id as string;
    if (!newItemId) {
      throw new HttpException(
        { success: false, error: 'Failed to create item from image' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    await this.businessImagesService.linkLibraryImageToNewItem(
      businessId,
      image.id,
      newItemId
    );

    return {
      id: newItemId,
      name: (newItem.name as string) ?? name,
      sku: (newItem.sku as string | null) ?? sku,
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
      imageUrls: [imageUrl],
      caption,
      altText,
      hint: dto.hint?.trim() || dto.name?.trim() || null,
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

  async listAllCollections(itemId?: string, businessId?: string) {
    const collectionsResult = await this.hasuraSystemService.executeQuery<{
      collections: Array<{
        id: string;
        slug: string;
        name_en: string;
        name_fr: string;
        description_en: string | null;
        description_fr: string | null;
        image_url: string | null;
        is_featured: boolean;
        sort_order: number;
      }>;
    }>(`
      query AllCollections {
        collections(order_by: [{ sort_order: asc }, { name_en: asc }]) {
          id slug name_en name_fr description_en description_fr image_url is_featured sort_order
        }
      }
    `);
    let assignedIds = new Set<string>();
    if (itemId && businessId) {
      const item = await this.getSingleItem(businessId, itemId);
      assignedIds = new Set(
        (item.item_collections ?? []).map((ic: { collection_id: string }) => ic.collection_id)
      );
    }
    return (collectionsResult.collections ?? []).map((c) => ({
      ...c,
      assigned: assignedIds.has(c.id),
    }));
  }

  async setItemCollections(
    businessId: string,
    itemId: string,
    collectionIds: string[]
  ): Promise<void> {
    await this.getSingleItem(businessId, itemId);
    await this.hasuraUserService.executeMutation(
      `mutation DeleteItemCollections($itemId: uuid!) {
        delete_item_collections(where: { item_id: { _eq: $itemId } }) { affected_rows }
      }`,
      { itemId }
    );
    if (!collectionIds.length) return;
    await this.hasuraUserService.executeMutation(
      `mutation InsertItemCollections($objects: [item_collections_insert_input!]!) {
        insert_item_collections(objects: $objects) { affected_rows }
      }`,
      {
        objects: collectionIds.map((collectionId) => ({
          item_id: itemId,
          collection_id: collectionId,
        })),
      }
    );
  }

  async getItemCollectionSuggestions(
    businessId: string,
    itemId: string
  ): Promise<
    Array<{
      collectionId: string;
      slug: string;
      name_en: string;
      name_fr: string;
      source: 'ai';
      reason?: string;
    }>
  > {
    const item = await this.getSingleItem(businessId, itemId);
    const assigned = new Set(
      (item.item_collections ?? []).map((ic: { collection_id: string }) => ic.collection_id)
    );
    try {
      const allCollections = await this.listAllCollections();
      const imageUrls = (item.item_images ?? [])
        .filter((img: { image_type: string }) => img.image_type === 'main')
        .map((img: { image_url: string }) => img.image_url)
        .slice(0, 2);
      const aiRows = await this.aiService.generateCollectionSuggestions({
        itemName: item.name,
        description: item.description,
        subCategoryName: item.item_sub_category?.name,
        categoryName: item.item_sub_category?.item_category?.name,
        brandName: item.brand?.name,
        imageUrls,
        availableCollections: allCollections.map((c) => ({
          id: c.id,
          slug: c.slug,
          name_en: c.name_en,
          name_fr: c.name_fr,
        })),
      });
      return aiRows
        .filter((s) => !assigned.has(s.collectionId))
        .slice(0, 8)
        .map((s) => ({ ...s, source: 'ai' as const }));
    } catch (error: any) {
      this.logger.warn(
        `AI collection suggestions skipped for item ${itemId}: ${error?.message}`
      );
      return [];
    }
  }
}
