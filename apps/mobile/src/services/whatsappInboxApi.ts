import { apiRequest, apiRequestBlob } from './apiClient';
import type {
  WhatsAppInboxListResult,
  WhatsAppInboxStatus,
  WhatsAppInboxThreadResult,
  WhatsAppInboxConversation,
} from '../types/whatsappInbox';

export async function fetchWhatsAppInbox(params: {
  status?: WhatsAppInboxStatus | 'all';
  search?: string;
  offset?: number;
  limit?: number;
}): Promise<WhatsAppInboxListResult> {
  const search = new URLSearchParams();
  search.set('status', params.status ?? 'open');
  search.set('offset', String(params.offset ?? 0));
  search.set('limit', String(params.limit ?? 30));
  if (params.search?.trim()) search.set('search', params.search.trim());
  const res = await apiRequest<WhatsAppInboxListResult>(
    `/admin/whatsapp/inbox?${search.toString()}`,
    { method: 'GET' }
  );
  return {
    items: res.items ?? [],
    total: res.total ?? 0,
    configured: res.configured ?? false,
  };
}

export async function fetchWhatsAppInboxThread(
  conversationId: string,
  params?: { offset?: number; limit?: number }
): Promise<WhatsAppInboxThreadResult> {
  const search = new URLSearchParams();
  search.set('offset', String(params?.offset ?? 0));
  search.set('limit', String(params?.limit ?? 100));
  const res = await apiRequest<WhatsAppInboxThreadResult>(
    `/admin/whatsapp/inbox/${conversationId}/messages?${search.toString()}`,
    { method: 'GET' }
  );
  return {
    ...res,
    items: (res.items ?? []).map((item) => ({
      ...item,
      media: item.media ?? null,
    })),
  };
}

export async function sendWhatsAppInboxReply(
  conversationId: string,
  body: string
): Promise<{ wamid?: string; conversation: WhatsAppInboxConversation }> {
  return apiRequest(`/admin/whatsapp/inbox/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function patchWhatsAppInboxConversation(
  conversationId: string,
  patch: { markRead?: boolean; status?: WhatsAppInboxStatus }
): Promise<{ conversation: WhatsAppInboxConversation }> {
  return apiRequest(`/admin/whatsapp/inbox/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function fetchWhatsAppInboxMedia(
  messageId: string
): Promise<{ blob: Blob; mimeType: string }> {
  return apiRequestBlob(`/admin/whatsapp/inbox/messages/${messageId}/media`, {
    method: 'GET',
  });
}
