export interface BusinessCollectionOption {
  id: string;
  slug: string;
  name_en: string;
  name_fr: string;
  description_en: string | null;
  description_fr: string | null;
  image_url: string | null;
  is_featured: boolean;
  sort_order: number;
  assigned: boolean;
}

export interface CollectionSuggestion {
  collectionId: string;
  slug: string;
  name_en: string;
  name_fr: string;
  source: 'ai';
  reason?: string;
}

export interface ItemRefinementSuggestion {
  name?: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  descriptionSuggestion?: string;
  sku?: string;
  model?: string;
  color?: string;
  suggestedTagsEn?: string[];
  suggestedTagsFr?: string[];
  weight?: number;
  weightUnit?: string;
  dimensions?: string;
  isFragile?: boolean;
  isPerishable?: boolean;
  requiresSpecialHandling?: boolean;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  price?: number;
  currency?: string;
}
