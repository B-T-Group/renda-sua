import { apiRequest } from './apiClient';
import type { ThreadDetail, ThreadListItem, ThreadMessage } from '../types/threads';

export async function listMyThreads(): Promise<ThreadListItem[]> {
  return apiRequest<ThreadListItem[]>('/threads', { method: 'GET' });
}

export async function getThread(threadId: string): Promise<ThreadDetail> {
  return apiRequest<ThreadDetail>(`/threads/${threadId}`, { method: 'GET' });
}

export async function replyToThread(threadId: string, body: string): Promise<ThreadMessage> {
  return apiRequest<ThreadMessage>(`/threads/${threadId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function markThreadRead(threadId: string): Promise<void> {
  await apiRequest<void>(`/threads/${threadId}/read`, { method: 'POST' });
}

export async function adminSendThread(params: {
  recipientUserId: string;
  subject?: string;
  body: string;
}): Promise<{ success: boolean; data?: { thread: { id: string }; message: ThreadMessage } }> {
  return apiRequest('/admin/threads', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export const threadsApi = {
  listMyThreads,
  getThread,
  replyToThread,
  markThreadRead,
  adminSendThread,
};
