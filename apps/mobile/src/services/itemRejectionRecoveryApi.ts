import Auth0DirectService from './auth0DirectService';
import { api, resolveApiUrl } from './apiClient';
import { buildActivePersonaHeaders } from '../utils/activePersonaStorage';
import type {
  ItemAppeal,
  ItemCondition,
  ItemRejectionRecovery,
  RecoveryItemSnapshot,
} from '../types/itemRejectionRecovery';
import { ITEM_REJECTION_RECOVERY_GQL_FIELDS } from '../types/itemRejectionRecovery';
import {
  isNotFoundStatus,
  mergeRecoveryPayload,
  synthesizeRecoveryFromItem,
  unwrapApiData,
} from '../utils/itemRejectionRecovery';

export const ITEM_REJECTION_RECOVERY_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/rejection-recovery`;

export const ITEM_RESUBMIT_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/resubmit`;

export const ITEM_APPEALS_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/appeals`;

export const ITEM_APPEAL_EVIDENCE_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/appeals/evidence`;

export const ITEM_CONDITION_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/condition`;

export const ITEM_CLEANUP_COST_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/cleanup-cost`;

export const ITEM_TRANSLATE_PATH = '/ai/translate';

export interface ResubmitResult {
  moderation_status: string;
  withdrawn_appeal_id?: string | null;
  pending_resubmit?: boolean;
}

export interface ConditionUpdateResult {
  condition: ItemCondition;
  wear_note: string | null;
  is_used: boolean;
}

export interface CleanupCostResult {
  cost: number;
  balance: number;
  token_cost_per_image: number;
}

export interface TranslateResult {
  text: string;
  available: boolean;
}

export const itemRejectionRecoveryApi = {
  getRecovery,
  resubmit,
  createAppeal,
  updateCondition,
  uploadEvidence,
  getCleanupCost,
  translateText,
};

async function getRecovery(
  itemId: string,
  snapshot?: RecoveryItemSnapshot | null
): Promise<ItemRejectionRecovery> {
  try {
    const body = await api.get<ItemRejectionRecovery | { data?: ItemRejectionRecovery }>(
      ITEM_REJECTION_RECOVERY_PATH(itemId)
    );
    return mergeRecoveryPayload(unwrapApiData(body), snapshot);
  } catch (error: unknown) {
    if (isNotFoundStatus(error) && snapshot) {
      return synthesizeRecoveryFromItem(snapshot);
    }
    throw error;
  }
}

async function resubmit(
  itemId: string,
  confirmAppealWithdraw?: boolean
): Promise<ResubmitResult> {
  const body = await api.post<ResubmitResult | { data?: ResubmitResult }>(
    ITEM_RESUBMIT_PATH(itemId),
    { confirmAppealWithdraw: Boolean(confirmAppealWithdraw) }
  );
  return unwrapApiData(body);
}

async function createAppeal(
  itemId: string,
  payload: { reason: string; evidence_urls?: string[] }
): Promise<ItemAppeal> {
  const body = await api.post(ITEM_APPEALS_PATH(itemId), payload);
  const data = unwrapApiData(body) as { appeal?: ItemAppeal } | ItemAppeal;
  if (data && typeof data === 'object' && 'appeal' in data && data.appeal) {
    return data.appeal;
  }
  return data as ItemAppeal;
}

async function updateCondition(
  itemId: string,
  payload: { condition: ItemCondition; wear_note?: string | null }
): Promise<ConditionUpdateResult> {
  const body = await api.patch<
    ConditionUpdateResult | { data?: ConditionUpdateResult }
  >(ITEM_CONDITION_PATH(itemId), payload);
  return unwrapApiData(body);
}

async function uploadEvidence(
  itemId: string,
  file: { uri: string; fileName: string; contentType: string }
): Promise<string> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.fileName,
    type: file.contentType,
  } as unknown as Blob);
  const token = await Auth0DirectService.getAccessToken();
  const personaHeaders = await buildActivePersonaHeaders();
  const headers: Record<string, string> = { ...personaHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(resolveApiUrl(ITEM_APPEAL_EVIDENCE_PATH(itemId)), {
    method: 'POST',
    headers,
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    const error = new Error(text || `API ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  const parsed = text ? (JSON.parse(text) as { data?: { url?: string }; url?: string }) : {};
  return parsed.data?.url ?? parsed.url ?? '';
}

async function getCleanupCost(
  itemId: string,
  imageCount: number
): Promise<CleanupCostResult> {
  const qs = `?imageCount=${encodeURIComponent(String(imageCount))}`;
  const body = await api.get<CleanupCostResult | { data?: CleanupCostResult }>(
    `${ITEM_CLEANUP_COST_PATH(itemId)}${qs}`
  );
  return unwrapApiData(body);
}

async function translateText(
  text: string,
  targetLanguage: 'en' | 'fr'
): Promise<TranslateResult> {
  try {
    const body = await api.post(ITEM_TRANSLATE_PATH, { text, targetLanguage });
    const data = unwrapApiData(body) as { text?: string };
    return { text: data.text ?? text, available: true };
  } catch (error: unknown) {
    if (isNotFoundStatus(error)) return { text, available: false };
    throw error;
  }
}

export function recoveryGraphqlFieldList(): string {
  return ITEM_REJECTION_RECOVERY_GQL_FIELDS;
}
