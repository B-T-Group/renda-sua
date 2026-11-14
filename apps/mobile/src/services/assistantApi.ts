import { api } from './apiClient';
import { publicApiPost } from './publicApiClient';
import Auth0DirectService from './auth0DirectService';

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantMarketContext = {
  country_code: string;
  state?: string;
};

/** @deprecated Use {@link AssistantChatMessage} */
export type AssistantChatMessagePayload = AssistantChatMessage;

export type AssistantChatResponse = {
  reply: string;
  handoff: boolean;
  cards?: unknown;
  rental?: unknown;
  /** Chat contract v2 (eng plan §5.2); absent on today's backend. */
  blocks?: unknown[];
};

export async function postAssistantChat(
  messages: AssistantChatMessagePayload[],
  marketContext?: AssistantMarketContext | null,
  threadId?: string,
  rental?: { rentalDates?: { startDate?: string; endDate?: string } | null; rentalRefs?: Record<string, string> }
): Promise<AssistantChatResponse> {
  const token = await Auth0DirectService.getAccessToken();
  const body: {
    messages: AssistantChatMessagePayload[];
    market?: AssistantMarketContext;
    threadId?: string;
    rentalDates?: { startDate?: string; endDate?: string };
    rentalRefs?: Record<string, string>;
  } = {
    messages,
  };
  if (rental?.rentalDates?.startDate) body.rentalDates = rental.rentalDates;
  if (rental?.rentalRefs && Object.keys(rental.rentalRefs).length) body.rentalRefs = rental.rentalRefs;
  if (marketContext) {
    body.market = marketContext;
  }
  if (threadId) {
    body.threadId = threadId;
  }
  if (token) {
    return api.post<AssistantChatResponse>('/assistant/chat', body);
  }
  return publicApiPost<AssistantChatResponse>('/assistant/chat', body);
}
