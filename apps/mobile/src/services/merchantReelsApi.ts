import { apiRequest } from './apiClient';

export type MerchantReel = {
  id: string;
  business_id: string;
  subject_type: string;
  subject_id: string;
  subject_title?: string | null;
  caption: string | null;
  generation_source?: string | null;
  moderation_status: string;
  processing_status: string;
  processing_error?: string | null;
  source_s3_key?: string | null;
  is_active?: boolean;
  video_url: string | null;
  thumbnail_url: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ReelAiPreset = {
  id: string;
  labelKey: string;
  defaultLabel: string;
};

export type ReelAiTokenPackId =
  | 'reel_ai_pack_1'
  | 'reel_ai_pack_5'
  | 'reel_ai_pack_15';

export async function listMerchantReels(filters?: {
  subjectType?: 'item' | 'rental' | 'business';
  subjectId?: string;
}): Promise<MerchantReel[]> {
  const params = new URLSearchParams();
  if (filters?.subjectType) params.set('subjectType', filters.subjectType);
  if (filters?.subjectId) params.set('subjectId', filters.subjectId);
  const qs = params.toString();
  const res = await apiRequest<{ success?: boolean } & MerchantReel[]>(
    `/reels/merchant${qs ? `?${qs}` : ''}`,
    { method: 'GET' }
  );
  return Array.isArray(res) ? res : ((res as { data?: MerchantReel[] }).data ?? []);
}

export async function setMerchantReelActive(
  reelId: string,
  isActive: boolean
): Promise<MerchantReel> {
  return apiRequest<MerchantReel>(
    `/reels/${encodeURIComponent(reelId)}/active`,
    { method: 'PATCH', body: JSON.stringify({ isActive }) }
  );
}

export async function retryMerchantReel(reelId: string): Promise<MerchantReel> {
  return apiRequest<MerchantReel>(
    `/reels/${encodeURIComponent(reelId)}/retry`,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export async function deleteMerchantReel(reelId: string): Promise<void> {
  await apiRequest(`/reels/${encodeURIComponent(reelId)}`, {
    method: 'DELETE',
  });
}

export async function createMerchantReel(body: {
  subjectType: 'item' | 'rental' | 'business';
  subjectId: string;
  marketCountry: string;
  caption?: string;
}): Promise<MerchantReel> {
  return apiRequest<MerchantReel>('/reels', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createReelUploadUrl(
  reelId: string,
  body: { fileName: string; contentType: string }
): Promise<{ url: string; key: string }> {
  return apiRequest(`/reels/${encodeURIComponent(reelId)}/upload-url`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitMerchantReel(reelId: string): Promise<void> {
  await apiRequest(`/reels/${encodeURIComponent(reelId)}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchReelAiPresets(): Promise<ReelAiPreset[]> {
  const res = await apiRequest<{ success: boolean; data: ReelAiPreset[] }>(
    '/reels/ai/presets',
    { method: 'GET' }
  );
  return res.data ?? [];
}

export async function generateAiReel(body: {
  subjectType: 'item' | 'rental';
  subjectId: string;
  presetId: string;
  prompt?: string;
  caption?: string;
  marketCountry: string;
  tier?: 'lite' | 'fast' | 'standard';
}): Promise<MerchantReel> {
  return apiRequest<MerchantReel>('/reels/ai-generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchReelAiTokenBalance(): Promise<number> {
  const res = await apiRequest<{
    success: boolean;
    data: { ai_reel_tokens: number };
  }>('/reel-ai-tokens/balance', { method: 'GET' });
  return res.data?.ai_reel_tokens ?? 0;
}

export async function fetchReelAiTokenPacks(): Promise<
  Array<{
    id: ReelAiTokenPackId;
    tokens: number;
    prices: { CAD: number; XAF: number };
  }>
> {
  const res = await apiRequest<{
    success: boolean;
    data: Array<{
      id: ReelAiTokenPackId;
      tokens: number;
      prices: { CAD: number; XAF: number };
    }>;
  }>('/reel-ai-tokens/packs', { method: 'GET' });
  return res.data ?? [];
}

export async function purchaseReelAiTokenPack(body: {
  packId: ReelAiTokenPackId;
  phoneNumber?: string;
  stripePaymentMethod?: 'checkout' | 'payment_sheet';
}): Promise<{
  payment_rail: 'stripe' | 'mobile_money';
  paymentUrl?: string;
  paymentPending?: boolean;
  tokens: number;
  amount: number;
  currency: string;
}> {
  const res = await apiRequest<{
    success: boolean;
    data: {
      payment_rail: 'stripe' | 'mobile_money';
      paymentUrl?: string;
      paymentPending?: boolean;
      tokens: number;
      amount: number;
      currency: string;
    };
  }>('/reel-ai-tokens/purchase', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function putReelVideoToPresignedUrl(
  uploadUrl: string,
  uri: string,
  contentType: string
): Promise<void> {
  const blob = await (await fetch(uri)).blob();
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
}
