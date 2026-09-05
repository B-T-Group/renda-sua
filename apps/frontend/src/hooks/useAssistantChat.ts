import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';

export type AssistantChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ChatApiResponse = {
  reply: string;
  handoff: boolean;
};

const STORAGE_KEY = 'rendasua.assistant.chat.v1';
/** Must stay within backend AssistantChatRequestDto @ArrayMaxSize. */
const MAX_API_MESSAGES = 20;

function loadStored(): AssistantChatMessage[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AssistantChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(messages: AssistantChatMessage[]): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(messages.slice(-MAX_API_MESSAGES))
    );
  } catch {
    /* ignore quota */
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAssistantChat() {
  const apiClient = useApiClient();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setMessages(loadStored());
  }, []);

  useEffect(() => {
    persist(messages);
  }, [messages]);

  const clearChat = useCallback(() => {
    requestIdRef.current += 1;
    setMessages([]);
    setHandoff(false);
    setError(null);
    setIsSending(false);
    persist([]);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;
      setError(null);
      const userMessage: AssistantChatMessage = {
        id: makeId(),
        role: 'user',
        content: trimmed,
      };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setIsSending(true);
      const requestId = ++requestIdRef.current;
      try {
        const payload = nextMessages.slice(-MAX_API_MESSAGES).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const { data } = await apiClient.post<ChatApiResponse>(
          '/assistant/chat',
          { messages: payload }
        );
        if (requestId !== requestIdRef.current) return;
        const reply = data?.reply?.trim() || '';
        if (reply) {
          setMessages((prev) => [
            ...prev,
            { id: makeId(), role: 'assistant', content: reply },
          ]);
        }
        if (data?.handoff) setHandoff(true);
      } catch (err: any) {
        if (requestId !== requestIdRef.current) return;
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Failed to reach the assistant'
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSending(false);
        }
      }
    },
    [apiClient, isSending, messages]
  );

  return {
    messages,
    isSending,
    error,
    handoff,
    sendMessage,
    clearChat,
  };
}
