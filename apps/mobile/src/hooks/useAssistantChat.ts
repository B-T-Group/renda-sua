import { useCallback, useRef, useState } from 'react';
import {
  postAssistantChat,
  type AssistantChatMessagePayload,
} from '../services/assistantApi';

export type AssistantUiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Must stay within backend AssistantChatRequestDto @ArrayMaxSize. */
const MAX_API_MESSAGES = 20;

export function useAssistantChat() {
  const [messages, setMessages] = useState<AssistantUiMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const requestIdRef = useRef(0);

  const clearChat = useCallback(() => {
    requestIdRef.current += 1;
    setMessages([]);
    setError(null);
    setHandoff(false);
    setIsSending(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;
      setError(null);
      const userMessage: AssistantUiMessage = {
        id: makeId(),
        role: 'user',
        content: trimmed,
      };
      const next = [...messages, userMessage];
      setMessages(next);
      setIsSending(true);
      const requestId = ++requestIdRef.current;
      try {
        const payload: AssistantChatMessagePayload[] = next
          .slice(-MAX_API_MESSAGES)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));
        const data = await postAssistantChat(payload);
        if (requestId !== requestIdRef.current) return;
        if (data.reply?.trim()) {
          setMessages((prev) => [
            ...prev,
            { id: makeId(), role: 'assistant', content: data.reply.trim() },
          ]);
        }
        if (data.handoff) setHandoff(true);
      } catch (e: any) {
        if (requestId !== requestIdRef.current) return;
        setError(e?.message ?? 'Failed to reach the assistant');
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSending(false);
        }
      }
    },
    [isSending, messages]
  );

  return { messages, isSending, error, handoff, sendMessage, clearChat };
}
