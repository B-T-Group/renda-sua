import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import { api } from './apiClient';

export interface PaginatedItemLikes {
  items: CatalogInventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ItemLikesEnvelope {
  success: boolean;
  data: PaginatedItemLikes;
  message?: string;
}

interface SetLikeEnvelope {
  success: boolean;
  data: { liked: boolean; likes_count: number };
}

export async function setItemLike(
  itemId: string,
  liked: boolean
): Promise<{ liked: boolean; likes_count: number }> {
  const res = await api.put<SetLikeEnvelope>(`/item-likes/${itemId}`, { liked });
  return res.data;
}

export async function fetchItemLikes(
  page = 1,
  limit = 20
): Promise<PaginatedItemLikes> {
  const res = await api.get<ItemLikesEnvelope>(
    `/item-likes?page=${page}&limit=${limit}`
  );
  return res.data;
}
