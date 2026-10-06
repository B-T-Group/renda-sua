import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useApiClient } from '../hooks/useApiClient';
import { useSessionAuth } from './SessionAuthContext';

export type AssistantChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ChatApiResponse = {
  reply: string;
  handoff: boolean;
};

interface AssistantChatContextType {
  messages: AssistantChatMessage[];
  isSending: boolean;
  error: string | null;
  handoff: boolean;
  threadId: string;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
}

const AssistantChatContext = createContext<AssistantChatContextType | null>(
  null
);

const STORAGE_KEY_MESSAGES = 'rendasua.assistant.chat.v1';
const STORAGE_KEY_THREAD_ID = 'rendasua.assistant.thread_id.v1';
const STORAGE_KEY_LAST_ACTIVITY = 'rendasua.assistant.last_activity.v1';
const STORAGE_KEY_AUTH_STATE = 'rendasua.assistant.auth_state.v1';
const MAX_API_MESSAGES = 20;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function generateThreadId(): string {
  return crypto.randomUUID();
}

function loadStored(): AssistantChatMessage[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_MESSAGES);
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
      STORAGE_KEY_MESSAGES,
      JSON.stringify(messages.slice(-MAX_API_MESSAGES))
    );
  } catch {
    /* ignore quota */
  }
}

function loadThreadId(): string {
  if (typeof sessionStorage === 'undefined') return generateThreadId();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_THREAD_ID);
    return raw || generateThreadId();
  } catch {
    return generateThreadId();
  }
}

function persistThreadId(threadId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY_THREAD_ID, threadId);
  } catch {
    /* ignore quota */
  }
}

function loadLastActivity(): number {
  if (typeof sessionStorage === 'undefined') return Date.now();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
    return raw ? parseInt(raw, 10) : Date.now();
  } catch {
    return Date.now();
  }
}

function persistLastActivity(timestamp: number): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, timestamp.toString());
  } catch {
    /* ignore quota */
  }
}

function loadAuthState(): string {
  if (typeof sessionStorage === 'undefined') return 'unknown';
  try {
    return sessionStorage.getItem(STORAGE_KEY_AUTH_STATE) || 'unknown';
  } catch {
    return 'unknown';
  }
}

function persistAuthState(state: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY_AUTH_STATE, state);
  } catch {
    /* ignore quota */
  }
}

function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AssistantChatProvider({ children }: { children: ReactNode }) {
  const apiClient = useApiClient();
  const { isAuthenticated } = useSessionAuth();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [threadId, setThreadId] = useState<string>(() => loadThreadId());
  const requestIdRef = useRef(0);
  const authStateRef = useRef<string>(loadAuthState());

  // Load messages from sessionStorage on mount
  useEffect(() => {
    setMessages(loadStored());
  }, []);

  // Persist messages when they change
  useEffect(() => {
    persist(messages);
  }, [messages]);

  // Check for idle timeout and rotate thread_id if needed
  useEffect(() => {
    const lastActivity = loadLastActivity();
    const now = Date.now();
    if (now - lastActivity > IDLE_TIMEOUT_MS) {
      // Idle timeout: rotate thread_id
      const newThreadId = generateThreadId();
      setThreadId(newThreadId);
      persistThreadId(newThreadId);
      setMessages([]);
      setHandoff(false);
      persist([]);
    }
  }, []);

  // Rotate thread_id when auth state changes
  useEffect(() => {
    const currentAuthState = isAuthenticated ? 'authenticated' : 'guest';
    const previousAuthState = authStateRef.current;

    if (previousAuthState !== 'unknown' && previousAuthState !== currentAuthState) {
      // Auth state changed: rotate thread_id
      const newThreadId = generateThreadId();
      setThreadId(newThreadId);
      persistThreadId(newThreadId);
      persistAuthState(currentAuthState);
      authStateRef.current = currentAuthState;
      // Clear messages on auth state change
      setMessages([]);
      setHandoff(false);
      persist([]);
    } else if (previousAuthState === 'unknown') {
      // Initialize auth state
      persistAuthState(currentAuthState);
      authStateRef.current = currentAuthState;
    }
  }, [isAuthenticated]);

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    persistLastActivity(now);
  }, []);

  const clearChat = useCallback(() => {
    requestIdRef.current += 1;
    const newThreadId = generateThreadId();
    setThreadId(newThreadId);
    persistThreadId(newThreadId);
    setMessages([]);
    setHandoff(false);
    setError(null);
    setIsSending(false);
    persist([]);
    updateLastActivity();
  }, [updateLastActivity]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;
      setError(null);
      updateLastActivity();

      const userMessage: AssistantChatMessage = {
        id: makeMessageId(),
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
            { id: makeMessageId(), role: 'assistant', content: reply },
          ]);
        }
        if (data?.handoff) setHandoff(true);
        updateLastActivity();
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
    [apiClient, isSending, messages, updateLastActivity]
  );

  const value: AssistantChatContextType = {
    messages,
    isSending,
    error,
    handoff,
    threadId,
    sendMessage,
    clearChat,
  };

  return (
    <AssistantChatContext.Provider value={value}>
      {children}
    </AssistantChatContext.Provider>
  );
}

export function useAssistantChat(): AssistantChatContextType {
  const context = useContext(AssistantChatContext);
  if (!context) {
    throw new Error(
      'useAssistantChat must be used within an AssistantChatProvider'
    );
  }
  return context;
}
