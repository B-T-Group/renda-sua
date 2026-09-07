export interface CollectionSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  preview_image_urls?: string[];
  is_featured: boolean;
  sort_order: number;
  listing_count: number;
}

export interface CollectionsListEnvelope {
  success: boolean;
  data: { collections: CollectionSummary[] };
  message?: string;
}
