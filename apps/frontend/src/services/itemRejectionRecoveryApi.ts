import type { AxiosInstance } from 'axios';
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

export function createItemRejectionRecoveryApi(client: AxiosInstance) {
  return {
    getRecovery: (itemId: string, snapshot?: RecoveryItemSnapshot | null) =>
      getRecovery(client, itemId, snapshot),
    resubmit: (itemId: string, confirmAppealWithdraw?: boolean) =>
      resubmit(client, itemId, confirmAppealWithdraw),
    createAppeal: (
      itemId: string,
      body: { reason: string; evidence_urls?: string[] }
    ) => createAppeal(client, itemId, body),
    updateCondition: (
      itemId: string,
      body: { condition: ItemCondition; wear_note?: string | null }
    ) => updateCondition(client, itemId, body),
    uploadEvidence: (itemId: string, file: File) =>
      uploadEvidence(client, itemId, file),
    getCleanupCost: (itemId: string, imageCount: number) =>
      getCleanupCost(client, itemId, imageCount),
    translateText: (text: string, targetLanguage: 'en' | 'fr') =>
      translateText(client, text, targetLanguage),
  };
}

async function getRecovery(
  client: AxiosInstance,
  itemId: string,
  snapshot?: RecoveryItemSnapshot | null
): Promise<ItemRejectionRecovery> {
  try {
    const res = await client.get(ITEM_REJECTION_RECOVERY_PATH(itemId));
    return mergeRecoveryPayload(unwrapApiData(res.data), snapshot);
  } catch (error: any) {
    if (isNotFoundStatus(error) && snapshot) {
      return synthesizeRecoveryFromItem(snapshot);
    }
    throw error;
  }
}

async function resubmit(
  client: AxiosInstance,
  itemId: string,
  confirmAppealWithdraw?: boolean
): Promise<ResubmitResult> {
  const res = await client.post(ITEM_RESUBMIT_PATH(itemId), {
    confirmAppealWithdraw: Boolean(confirmAppealWithdraw),
  });
  return unwrapApiData(res.data);
}

async function createAppeal(
  client: AxiosInstance,
  itemId: string,
  body: { reason: string; evidence_urls?: string[] }
): Promise<ItemAppeal> {
  const res = await client.post(ITEM_APPEALS_PATH(itemId), body);
  const data = unwrapApiData(res.data) as { appeal?: ItemAppeal } | ItemAppeal;
  if (data && typeof data === 'object' && 'appeal' in data && data.appeal) {
    return data.appeal;
  }
  return data as ItemAppeal;
}

async function updateCondition(
  client: AxiosInstance,
  itemId: string,
  body: { condition: ItemCondition; wear_note?: string | null }
): Promise<ConditionUpdateResult> {
  const res = await client.patch(ITEM_CONDITION_PATH(itemId), body);
  return unwrapApiData(res.data);
}

async function uploadEvidence(
  client: AxiosInstance,
  itemId: string,
  file: File
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post(ITEM_APPEAL_EVIDENCE_PATH(itemId), form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const data = unwrapApiData(res.data) as { url?: string };
  return data.url ?? '';
}

async function getCleanupCost(
  client: AxiosInstance,
  itemId: string,
  imageCount: number
): Promise<CleanupCostResult> {
  const res = await client.get(ITEM_CLEANUP_COST_PATH(itemId), {
    params: { imageCount },
  });
  return unwrapApiData(res.data);
}

async function translateText(
  client: AxiosInstance,
  text: string,
  targetLanguage: 'en' | 'fr'
): Promise<TranslateResult> {
  try {
    const res = await client.post(ITEM_TRANSLATE_PATH, { text, targetLanguage });
    const data = unwrapApiData(res.data) as { text?: string };
    return { text: data.text ?? text, available: true };
  } catch (error: any) {
    if (isNotFoundStatus(error)) return { text, available: false };
    throw error;
  }
}

export function recoveryGraphqlFieldList(): string {
  return ITEM_REJECTION_RECOVERY_GQL_FIELDS;
}
