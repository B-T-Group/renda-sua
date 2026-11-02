import { api } from './apiClient';
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

export const ITEM_CONDITION_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/condition`;

export const ITEM_AI_CLEANUP_QUOTE_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/ai-cleanup-quote`;

export const ITEM_APPEAL_EVIDENCE_UPLOAD_PATH = (itemId: string) =>
  `/business-items/items/${encodeURIComponent(itemId)}/appeal-evidence/upload-url`;

export const ITEM_TRANSLATE_PATH = '/ai/translate';

export interface AppealEvidenceUploadTicket {
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  key: string;
  expiresAt: string;
  maxBytes: number;
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
  getCleanupQuote,
  translateText,
};

async function getRecovery(itemId: string): Promise<ItemRejectionRecovery> {
  const body = await api.get<ItemRejectionRecovery | { data?: ItemRejectionRecovery }>(
    ITEM_RECOVERY_PATH(itemId)
  );
  return unwrapApiData(body);
}

async function resubmit(
  itemId: string,
  confirmWithdrawAppeal?: boolean
): Promise<ResubmitResult> {
  const body = await api.post<ResubmitResult | { data?: ResubmitResult }>(
    ITEM_RESUBMIT_PATH(itemId),
    { confirmWithdrawAppeal: Boolean(confirmWithdrawAppeal) }
  );
  return unwrapApiData(body);
}

async function createAppeal(
  itemId: string,
  payload: { reason: string; evidenceKeys?: string[] }
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
  payload: { condition: ItemCondition; wearNote?: string | null }
): Promise<ConditionUpdateResult> {
  const body = await api.patch<
    ConditionUpdateResult | { data?: ConditionUpdateResult }
  >(ITEM_CONDITION_PATH(itemId), payload);
  return unwrapApiData(body);
}

async function getCleanupQuote(
  itemId: string,
  imageCount: number
): Promise<AiCleanupQuote> {
  const qs = `?imageCount=${encodeURIComponent(String(imageCount))}`;
  const body = await api.get<AiCleanupQuote | { data?: AiCleanupQuote }>(
    `${ITEM_AI_CLEANUP_QUOTE_PATH(itemId)}${qs}`
  );
  return unwrapApiData(body);
}

async function requestEvidenceUploadUrl(
  itemId: string,
  contentType: string,
  fileSize: number
): Promise<AppealEvidenceUploadTicket> {
  const body = await api.post<
    AppealEvidenceUploadTicket | { data?: AppealEvidenceUploadTicket }
  >(ITEM_APPEAL_EVIDENCE_UPLOAD_PATH(itemId), { contentType, fileSize });
  return unwrapApiData(body);
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
  return ticket.key;
}

async function uploadEvidence(
  itemId: string,
  file: { uri: string; fileName: string; contentType: string; fileSize?: number }
): Promise<string> {
  const contentType = normalizeEvidenceContentType(file.contentType, file.fileName);
  const blobRes = await fetch(file.uri);
  const blob = await blobRes.blob();
  const fileSize = file.fileSize && file.fileSize > 0 ? file.fileSize : blob.size;
  if (!isAllowedEvidenceFile({ type: contentType, name: file.fileName, size: fileSize })) {
    throw new Error('Use a JPEG, PNG or WebP photo');
  }
  const ticket = await requestEvidenceUploadUrl(itemId, contentType, fileSize);
  if (!isAllowedEvidenceFile({ type: contentType, name: file.fileName, size: fileSize }, ticket.maxBytes)) {
    throw new Error('Use a JPEG, PNG or WebP photo');
  }
  return putEvidenceFile(ticket, blob);
}

async function translateText(
  text: string,
  targetLanguage: 'en' | 'fr'
): Promise<TranslateResult> {
  try {
    const body = await api.post(ITEM_TRANSLATE_PATH, { text, targetLanguage });
    const data = unwrapApiData(body) as { text?: string };
    return { text: data.text ?? text, available: true };
  } catch {
    return { text, available: false };
  }
}
