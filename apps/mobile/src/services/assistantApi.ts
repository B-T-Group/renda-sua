import { api } from './apiClient';
import { publicApiPost } from './publicApiClient';
import Auth0DirectService from './auth0DirectService';

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** @deprecated Use {@link AssistantChatMessage} */
export type AssistantChatMessagePayload = AssistantChatMessage;

export type AssistantChatResponse = {
  reply: string;
  handoff: boolean;
};

export async function postAssistantChat(
  messages: AssistantChatMessagePayload[]
): Promise<AssistantChatResponse> {
  const token = await Auth0DirectService.getAccessToken();
  if (token) {
    return api.post<AssistantChatResponse>('/assistant/chat', { messages });
  }
  return publicApiPost<AssistantChatResponse>('/assistant/chat', { messages });
}
