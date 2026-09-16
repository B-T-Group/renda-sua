import { api } from './apiClient';

export interface FollowedBusiness {
  id: string;
  name: string;
  followers_count: number;
  following: boolean;
}

export interface PaginatedBusinessFollows {
  businesses: FollowedBusiness[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface BusinessFollowsEnvelope {
  success: boolean;
  data: PaginatedBusinessFollows;
  message?: string;
}

interface SetFollowEnvelope {
  success: boolean;
  data: { following: boolean; followers_count: number };
}

export async function setBusinessFollow(
  businessId: string,
  following: boolean
): Promise<{ following: boolean; followers_count: number }> {
  const res = await api.put<SetFollowEnvelope>(
    `/business-follows/${businessId}`,
    { following }
  );
  return res.data;
}

export async function fetchBusinessFollows(
  page = 1,
  limit = 20
): Promise<PaginatedBusinessFollows> {
  const res = await api.get<BusinessFollowsEnvelope>(
    `/business-follows?page=${page}&limit=${limit}`
  );
  return res.data;
}
