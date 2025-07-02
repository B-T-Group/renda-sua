// Define the possible image types based on the database enum
export type ImageType = 'main' | 'thumbnail' | 'detail' | 'gallery' | 'angle';

export interface ItemImage {
  id: string;
  item_id?: string;
  image_url: string;
  image_type: ImageType;
  alt_text?: string;
  caption?: string;
  display_order?: number;
  uploaded_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateItemImageData {
  item_id: string;
  image_url: string;
  image_type: ImageType;
  alt_text?: string;
  caption?: string;
  display_order: number;
  uploaded_by: string;
}
