import { publicApiGet } from './publicApiClient';

export interface CatalogCategoryTile {
  id: number;
  name: string;
  imageUrl: string | null;
  listingCount: number;
}

interface CategoryModule {
  id: string;
  type: string;
  title: string;
  items?: CatalogCategoryTile[];
}

interface ExperienceResponse {
  success: boolean;
  data?: { modules?: CategoryModule[] };
}

export async function fetchCatalogCategoryRail(params: {
  country_code?: string;
  state?: string;
  language: string;
}): Promise<{ title: string; items: CatalogCategoryTile[] } | null> {
  const response = await publicApiGet<ExperienceResponse>('/catalog/experience', {
    ...params,
    layout: 'discovery',
    device: 'mobile',
  });
  const module = response.data?.modules?.find(
    (row) => row.type === 'CATEGORY_CAROUSEL'
  );
  if (!module?.items?.length) return null;
  return { title: module.title, items: module.items };
}

export async function fetchCatalogCategories(params: {
  country_code?: string;
  state?: string;
}): Promise<CatalogCategoryTile[]> {
  const response = await publicApiGet<{
    data?: { categories?: CatalogCategoryTile[] };
  }>('/catalog/experience/categories', params);
  return response.data?.categories ?? [];
}
