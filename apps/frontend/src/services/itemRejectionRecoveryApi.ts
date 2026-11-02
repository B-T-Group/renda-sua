import type { AxiosInstance } from 'axios';
import type {
  AiCleanupQuote,
  ConditionUpdateResult,
  ItemAppeal,
  ItemCondition,
  ItemRejectionRecovery,
  ResubmitResult,
} from '../types/itemRejectionRecovery';
import {
  isAllowedEvidenceFile,
  normalizeEvidenceContentType,
  unwrapApiData,
} from '../utils/itemRejectionRecovery';

export const ITEM_RECOVERY_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/recovery`;

export const ITEM_RESUBMIT_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/resubmit`;

export const ITEM_APPEALS_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/appeals`;

export const ITEM_APPEAL_WITHDRAW_PATH = (itemId: string, appealId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/appeals/${encodeURIComponent(appealId)}/withdraw`;

export const ITEM_CONDITION_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/condition`;

export const ITEM_AI_CLEANUP_QUOTE_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/ai-cleanup-quote`;

export const ITEM_APPEAL_EVIDENCE_UPLOAD_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/appeal-evidence/upload-url`;

export const ITEM_TRANSLATE_PATH = '/ai/translate';

export interface AppealEvidenceUploadTicket {
  uploadUrl: string;
  method: 'PUT';
  headers: { 'Content-Type': string; 'Content-Length': string };
  key: string;
  evidenceUrl: string;
  expiresAt: string;
  maxBytes: number;
}

export interface TranslateResult {
  text: string;
  available: boolean;
}

export function createItemRejectionRecoveryApi(client: AxiosInstance) {
  return {
    getRecovery: (itemId: string) => getRecovery(client, itemId),
    resubmit: (itemId: string, confirmWithdrawAppeal?: boolean) =>
      resubmit(client, itemId, confirmWithdrawAppeal),
    createAppeal: (itemId: string, body: { reason: string; evidenceUrls?: string[] }) =>
      createAppeal(client, itemId, body),
    withdrawAppeal: (itemId: string, appealId: string) =>
      withdrawAppeal(client, itemId, appealId),
    updateCondition: (
      itemId: string,
      body: { condition: ItemCondition; wearNote?: string | null }
    ) => updateCondition(client, itemId, body),
    uploadEvidence: (itemId: string, file: File) => uploadEvidence(client, itemId, file),
    getCleanupQuote: (itemId: string, imageCount: number) =>
      getCleanupQuote(client, itemId, imageCount),
    translateText: (text: string, targetLanguage: 'en' | 'fr') =>
      translateText(client, text, targetLanguage),
  };
}

async function getRecovery(
  client: AxiosInstance,
  itemId: string
): Promise<ItemRejectionRecovery> {
  const res = await client.get(ITEM_RECOVERY_PATH(itemId));
  return unwrapApiData(res.data);
}

async function resubmit(
  client: AxiosInstance,
  itemId: string,
  confirmWithdrawAppeal?: boolean
): Promise<ResubmitResult> {
  const res = await client.post(ITEM_RESUBMIT_PATH(itemId), {
    confirmWithdrawAppeal: Boolean(confirmWithdrawAppeal),
  });
  return unwrapApiData(res.data);
}

async function createAppeal(
  client: AxiosInstance,
  itemId: string,
  body: { reason: string; evidenceUrls?: string[] }
): Promise<ItemAppeal> {
  const res = await client.post(ITEM_APPEALS_PATH(itemId), body);
  const data = unwrapApiData(res.data) as { appeal?: ItemAppeal } | ItemAppeal;
  if (data && typeof data === 'object' && 'appeal' in data && data.appeal) {
    return data.appeal;
  }
  return data as ItemAppeal;
}

async function withdrawAppeal(
  client: AxiosInstance,
  itemId: string,
  appealId: string
): Promise<{ appealId: string; status: 'withdrawn' }> {
  const res = await client.post(ITEM_APPEAL_WITHDRAW_PATH(itemId, appealId), {});
  return unwrapApiData(res.data);
}

async function updateCondition(
  client: AxiosInstance,
  itemId: string,
  body: { condition: ItemCondition; wearNote?: string | null }
): Promise<ConditionUpdateResult> {
  const res = await client.patch(ITEM_CONDITION_PATH(itemId), body);
  return unwrapApiData(res.data);
}

async function getCleanupQuote(
  client: AxiosInstance,
  itemId: string,
  imageCount: number
): Promise<AiCleanupQuote> {
  const res = await client.get(ITEM_AI_CLEANUP_QUOTE_PATH(itemId), {
    params: { imageCount },
  });
  return unwrapApiData(res.data);
}

async function requestEvidenceUploadUrl(
  client: AxiosInstance,
  itemId: string,
  contentType: string,
  fileSize: number
): Promise<AppealEvidenceUploadTicket> {
  const res = await client.post(ITEM_APPEAL_EVIDENCE_UPLOAD_PATH(itemId), {
    contentType,
    fileSize,
  });
  return unwrapApiData(res.data);
}

async function putEvidenceFile(
  ticket: AppealEvidenceUploadTicket,
  body: Blob
): Promise<string> {
  const putRes = await fetch(ticket.uploadUrl, {
    method: ticket.method,
    headers: ticket.headers,
    body,
  });
  if (!putRes.ok) throw new Error('Failed to upload evidence');
  return ticket.evidenceUrl;
}

async function uploadEvidence(
  client: AxiosInstance,
  itemId: string,
  file: File
): Promise<string> {
  const contentType = normalizeEvidenceContentType(file.type, file.name);
  if (!isAllowedEvidenceFile({ type: contentType, name: file.name, size: file.size })) {
    throw new Error('Use a JPEG, PNG or WebP photo');
  }
  const ticket = await requestEvidenceUploadUrl(client, itemId, contentType, file.size);
  return putEvidenceFile(ticket, file);
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
  } catch {
    return { text, available: false };
  }
}
