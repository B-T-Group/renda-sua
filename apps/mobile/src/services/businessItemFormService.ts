import { gql } from '@apollo/client';
import { api } from './apiClient';
import { client } from './apolloClient';
import { businessApi } from './businessApi';
import type {
  BusinessItemDetail,
  ItemFormBrand,
  ItemFormCategory,
  ItemFormTag,
} from '../types/business/itemForm';
import type { UpdateBusinessItemPayload } from '../types/business/items';

const GET_CATEGORIES = gql`
  query GetItemCategories {
    item_categories(order_by: { name: asc }) {
      id
      name
      item_sub_categories(order_by: { name: asc }) {
        id
        name
        item_category_id
      }
    }
  }
`;

const GET_BRANDS = gql`
  query GetBrands {
    brands(order_by: { name: asc }) {
      id
      name
    }
  }
`;

const GET_TAGS = gql`
  query GetTags {
    tags(order_by: { name: asc }) {
      id
      name
    }
  }
`;

const INSERT_TAG = gql`
  mutation InsertTag($name: String!) {
    insert_tags_one(object: { name: $name }) {
      id
      name
    }
  }
`;

const DELETE_ITEM_TAGS = gql`
  mutation DeleteAllItemTagsForItem($itemId: uuid!) {
    delete_item_tags(where: { item_id: { _eq: $itemId } }) {
      affected_rows
    }
  }
`;

const INSERT_ITEM_TAGS = gql`
  mutation InsertItemTags($objects: [item_tags_insert_input!]!) {
    insert_item_tags(objects: $objects) {
      affected_rows
    }
  }
`;

export async function fetchBusinessItemDetail(itemId: string): Promise<BusinessItemDetail> {
  const res = await api.get<{ success: boolean; data: { item: BusinessItemDetail } }>(
    `/business-items/items/${itemId}`
  );
  if (!res.success || !res.data?.item) {
    throw new Error('Item not found');
  }
  return res.data.item;
}

export async function fetchItemFormCategories(): Promise<ItemFormCategory[]> {
  const res = await client.query<{ item_categories: ItemFormCategory[] }>({
    query: GET_CATEGORIES,
    fetchPolicy: 'network-only',
  });
  return res.data?.item_categories ?? [];
}

export async function fetchItemFormBrands(): Promise<ItemFormBrand[]> {
  const res = await client.query<{ brands: ItemFormBrand[] }>({
    query: GET_BRANDS,
    fetchPolicy: 'network-only',
  });
  return res.data?.brands ?? [];
}

export async function fetchItemFormTags(): Promise<ItemFormTag[]> {
  const res = await client.query<{ tags: ItemFormTag[] }>({
    query: GET_TAGS,
    fetchPolicy: 'network-only',
  });
  return res.data?.tags ?? [];
}

export async function createItemFormBrand(name: string): Promise<ItemFormBrand> {
  const res = await api.post<{ success: boolean; data: ItemFormBrand }>('/brands', {
    name: name.trim(),
    description: '',
  });
  if (!res.success || !res.data) {
    throw new Error('Failed to create brand');
  }
  return res.data;
}

export async function createItemFormCategory(name: string): Promise<ItemFormCategory> {
  const res = await api.post<{ success: boolean; data: ItemFormCategory }>('/categories', {
    name: name.trim(),
    description: '',
    status: 'draft',
  });
  if (!res.success || !res.data) {
    throw new Error('Failed to create category');
  }
  return { ...res.data, item_sub_categories: res.data.item_sub_categories ?? [] };
}

export async function createItemFormSubCategory(
  name: string,
  categoryId: number
): Promise<{ id: number; name: string; item_category_id: number }> {
  const res = await api.post<{
    success: boolean;
    data: { id: number; name: string; item_category_id: number };
  }>('/subcategories', {
    name: name.trim(),
    description: '',
    item_category_id: categoryId,
    status: 'draft',
  });
  if (!res.success || !res.data) {
    throw new Error('Failed to create subcategory');
  }
  return res.data;
}

export async function createItemFormTag(name: string): Promise<ItemFormTag> {
  const res = await client.mutate<{ insert_tags_one: ItemFormTag }>({
    mutation: INSERT_TAG,
    variables: { name: name.trim() },
  });
  const tag = res.data?.insert_tags_one;
  if (!tag) throw new Error('Failed to create tag');
  return tag;
}

export async function updateBusinessItemFields(
  itemId: string,
  body: UpdateBusinessItemPayload
): Promise<void> {
  const res = await businessApi.catalog.updateItem(itemId, body);
  if (!res.success) {
    throw new Error('Failed to update item');
  }
}

export async function setBusinessItemTags(itemId: string, tagIds: string[]): Promise<void> {
  await client.mutate({
    mutation: DELETE_ITEM_TAGS,
    variables: { itemId },
  });
  if (tagIds.length > 0) {
    await client.mutate({
      mutation: INSERT_ITEM_TAGS,
      variables: {
        objects: tagIds.map((tag_id) => ({ item_id: itemId, tag_id })),
      },
    });
  }
}

export async function generateItemDescription(body: {
  name: string;
  sku?: string;
  category?: string;
  subcategory?: string;
  price?: number;
  currency?: string;
  weight?: number;
  weight_unit?: string;
  brand?: string;
  language?: string;
}): Promise<string> {
  const res = await api.post<{ success?: boolean; description?: string }>(
    '/ai/generate-description',
    body
  );
  if (!res.description?.trim()) {
    throw new Error('No description generated');
  }
  return res.description.trim();
}
