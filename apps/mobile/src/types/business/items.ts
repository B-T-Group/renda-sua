import type { FoodAvailabilitySlot } from '../food';
import type {
  InventoryVariantPriceOverride,
  ItemVariant,
} from './itemVariant';

export interface BusinessFoodItemSettings {
  business_location_id: string;
  marked_unavailable_at?: string | null;
  availability_slots?: FoodAvailabilitySlot[];
}

export interface BusinessItemImage {
  id?: string;
  image_url?: string;
  image_type?: string | null;
  display_order?: number | null;
  alt_text?: string | null;
  /** True when an AI-enhanced version exists (not “currently showing”). */
  is_ai_cleaned?: boolean | null;
  /** True when a rembg version exists. */
  is_rembg_cleaned?: boolean | null;
  rembg_image_url?: string | null;
  enhanced_image_url?: string | null;
  original_image_url?: string | null;
  active_version?: 'original' | 'rembg' | 'enhanced' | null;
  thumbnail?: string | null;
  thumbnail_status?: string | null;
  /** Server-resolved display URL: thumbnail when ready, else image_url. */
  display_url?: string | null;
}

export interface BusinessItemCollectionLink {
  collection_id: string;
  collection?: {
    id: string;
    slug: string;
    name_en: string;
    name_fr: string;
  };
}

export interface BusinessInventoryRow {
  id: string;
  item_id?: string;
  business_location_id?: string;
  quantity: number;
  computed_available_quantity?: number;
  reserved_quantity?: number;
  is_active?: boolean;
  selling_price?: number;
  reorder_point?: number;
  variant_price_overrides?: InventoryVariantPriceOverride[];
  business_location?: { id: string; name: string; address_id?: string };
}

export interface BusinessCatalogItem {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  model?: string;
  color?: string;
  weight?: number | null;
  weight_unit?: string | null;
  dimensions?: string | null;
  item_sub_category_id?: number;
  item_sub_category?: {
    id: number;
    name: string;
    item_category?: { id: number; name: string };
  } | null;
  food_item_settings?: BusinessFoodItemSettings[];
  price?: number;
  currency?: string;
  is_active?: boolean;
  /** draft | pending | ai_reviewing | proposal_pending | approved | rejected */
  moderation_status?: string | null;
  /** Present when moderation_status is rejected */
  rejection_reason?: string | null;
  is_favorite?: boolean;
  pay_on_delivery_enabled?: boolean;
  pay_at_pickup_enabled?: boolean;
  shipping_enabled?: boolean;
  shipping_price?: number | null;
  shipping_currency?: string;
  is_fragile?: boolean;
  is_perishable?: boolean;
  is_used?: boolean;
  item_images?: BusinessItemImage[];
  item_variants?: ItemVariant[];
  item_collections?: BusinessItemCollectionLink[];
  item_tags?: Array<{ tag_id: string; tag: { id: string; name: string } }>;
  stripe_tax_code_id?: string;
  stripe_tax_code?: {
    id: string;
    name: string;
    description?: string | null;
    group_name?: string | null;
  } | null;
  /** Backend field name from page-data / items API */
  business_inventories?: BusinessInventoryRow[];
}

export interface BusinessPageData {
  items: BusinessCatalogItem[];
  business_locations: Array<{ id: string; name: string }>;
}

export interface UpdateInventoryPayload {
  quantity?: number;
  is_active?: boolean;
  selling_price?: number;
  /** Kept in sync with selling_price by default on mobile inventory edits. */
  unit_cost?: number;
}

export interface UpdateBusinessItemPayload {
  name?: string;
  description?: string;
  item_sub_category_id?: number;
  categoryName?: string;
  subCategoryName?: string;
  weight?: number | null;
  weight_unit?: string | null;
  dimensions?: string | null;
  price?: number;
  currency?: string;
  sku?: string | null;
  brand_id?: string | null;
  brandName?: string;
  model?: string | null;
  color?: string | null;
  is_fragile?: boolean;
  is_perishable?: boolean;
  is_used?: boolean;
  requires_special_handling?: boolean;
  min_order_quantity?: number;
  max_order_quantity?: number | null;
  is_active?: boolean;
  pay_on_delivery_enabled?: boolean;
  pay_at_pickup_enabled?: boolean;
  shipping_enabled?: boolean;
  shipping_price?: number | null;
  shipping_currency?: string;
  stripe_tax_code_id?: string;
}

export interface CreateItemFromImagePayload {
  imageId: string;
  /** Optional for eager draft creation — backend defaults to "Untitled product". */
  name?: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  description?: string;
  price?: number;
  currency?: string;
  hint?: string;
}

export interface QuickPublishPayload {
  locationId: string;
  quantity?: number;
  sellingPrice?: number;
}

export type SuggestionFieldConfidence = 'high' | 'medium' | 'low';

export interface ImageItemSuggestionConfidence {
  name: SuggestionFieldConfidence;
  categoryName: SuggestionFieldConfidence;
  subCategoryName: SuggestionFieldConfidence;
  brandName: SuggestionFieldConfidence;
  description: SuggestionFieldConfidence;
  price: SuggestionFieldConfidence;
}

export interface DuplicateCandidate {
  itemId: string;
  name: string;
  similarity: number;
}

export interface ListingQualityScore {
  score: number;
  label: 'poor' | 'fair' | 'good' | 'great';
  suggestedAction: string | null;
}

export interface CreateInventoryPayload {
  business_location_id: string;
  item_id: string;
  quantity: number;
  reserved_quantity: number;
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number;
  selling_price: number;
  is_active: boolean;
}

export interface BulkCreateBusinessImageInput {
  image_url: string;
  s3_key?: string;
  file_size?: number;
  format?: string;
  quality_score?: number | null;
  perceptual_hash?: string | null;
  validation_errors?: unknown[] | null;
  validation_warnings?: unknown[] | null;
  validated_at?: string | null;
}

export interface ImageItemSuggestions {
  name?: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  descriptionSuggestion?: string;
  price?: number;
  currency?: string;
  barcodeValues?: string[];
  weight?: number;
  weightUnit?: string;
  dimensions?: string;
  isUsed?: boolean;
  /** True when AI (or merchant flag) classified the photo as a cooked dish. */
  isFoodItem?: boolean;
  confidence?: ImageItemSuggestionConfidence;
  categoryAlternates?: string[];
  subCategoryAlternates?: string[];
  duplicateCandidates?: DuplicateCandidate[];
  listingQuality?: ListingQualityScore;
}

export interface CreatedSaleItemSummary {
  id: string;
  name: string;
  price?: number;
  currency?: string;
}
