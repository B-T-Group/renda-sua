import { api } from './apiClient';
import { awsApi, buildS3PublicUrl, S3_BUCKET } from './awsApi';
import type {
  AiCleanupQuote,
  ConditionUpdateResult,
  ItemAppeal,
  ItemCondition,
  ItemRejectionRecovery,
  ResubmitResult,
} from '../types/itemRejectionRecovery';
import { isAllowedEvidenceFile, unwrapApiData } from '../utils/itemRejectionRecovery';

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

export const ITEM_TRANSLATE_PATH = '/ai/translate';

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
  payload: { reason: string; evidenceUrls?: string[] }
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

async function uploadEvidence(
  itemId: string,
  file: { uri: string; fileName: string; contentType: string }
): Promise<string> {
  if (!isAllowedEvidenceFile({ type: file.contentType, name: file.fileName })) {
    throw new Error('Use images or a PDF');
  }
  const isPdf =
    file.contentType === 'application/pdf' || file.fileName.toLowerCase().endsWith('.pdf');
  const presigned = isPdf
    ? await api.post<{ success?: boolean; data?: { url?: string; key?: string } }>(
        '/aws/presigned-url/document',
        {
          bucketName: S3_BUCKET,
          originalFileName: file.fileName,
          contentType: file.contentType,
          prefix: `items/${itemId}/appeal-evidence`,
        }
      )
    : await awsApi.presignImageUpload({
        bucketName: S3_BUCKET,
        originalFileName: file.fileName,
        contentType: file.contentType,
        prefix: `items/${itemId}/appeal-evidence`,
      });
  const url = presigned.data?.url;
  const key = presigned.data?.key;
  if (!url || !key) throw new Error('Failed to prepare evidence upload');
  const blobRes = await fetch(file.uri);
  const blob = await blobRes.blob();
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.contentType },
    body: blob,
  });
  if (!putRes.ok) throw new Error('Failed to upload evidence');
  return buildS3PublicUrl(key);
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
