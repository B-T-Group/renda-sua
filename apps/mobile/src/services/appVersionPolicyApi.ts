import { api } from './apiClient';

export type MobileVersionPolicy = {
  minVersion: string | null;
  recommendedVersion: string | null;
};

export async function fetchMobileVersionPolicy(): Promise<MobileVersionPolicy> {
  const data = await api.get<MobileVersionPolicy>('/app/version-policy');
  return {
    minVersion: data?.minVersion ?? null,
    recommendedVersion: data?.recommendedVersion ?? null,
  };
}
