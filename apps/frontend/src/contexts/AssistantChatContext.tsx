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
  draft: string;
  isOffline: boolean;
  sendMessage: (text: string, isRetry?: boolean) => Promise<void>;
  setDraft: (draft: string) => void;
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

/**
 * Generate a UUID v4 with progressive fallbacks:
 * 1. crypto.randomUUID (modern browsers, HTTPS only)
 * 2. crypto.getRandomValues (all browsers, builds RFC4122 v4)
 * 3. Math.random (test environments, non-crypto fallback)
 */
export function generateThreadId(): string {
  // Try crypto.randomUUID first (modern browsers on HTTPS)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through to next method
    }
  }

  // Try crypto.getRandomValues (all browsers, build RFC4122 v4)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      // RFC4122 v4 UUID template: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      // We need 32 hex digits (ignoring the fixed '4')
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      
      // Build UUID parts
      const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        '4' + hex.substring(13, 16),
        ((parseInt(hex.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hex.substring(18, 20),
        hex.substring(20, 32),
      ].join('-');
    } catch {
      // Fall through to Math.random
    }
  }

  // Fallback to Math.random (test environments)
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
  const { isAuthenticated, isLoading: authLoading, user } = useSessionAuth();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [draft, setDraft] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [threadId, setThreadId] = useState<string>(() => {
    const id = loadThreadId();
    // Persist the initial thread_id immediately
    persistThreadId(id);
    return id;
  });
  const requestIdRef = useRef(0);
  const authIdentityRef = useRef<string | null>(null);
  const lastIdleCheckRef = useRef<number>(Date.now());

  // Load messages from sessionStorage on mount
  useEffect(() => {
    setMessages(loadStored());
  }, []);

  // Persist messages when they change
  useEffect(() => {
    persist(messages);
  }, [messages]);

  // Check idle timeout on focus and visibility change
  useEffect(() => {
    const checkIdle = () => {
      const lastActivity = loadLastActivity();
      const now = Date.now();
      if (now - lastActivity > IDLE_TIMEOUT_MS) {
        // Idle timeout: rotate thread_id
        const newThreadId = generateThreadId();
        setThreadId(newThreadId);
        persistThreadId(newThreadId);
        setMessages([]);
        setHandoff(false);
        setDraft('');
        setError(null);
        persist([]);
        persistLastActivity(now);
      }
      lastIdleCheckRef.current = now;
    };

    const handleFocus = () => checkIdle();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkIdle();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check on mount
    checkIdle();

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Rotate thread_id when auth identity changes
  useEffect(() => {
    // Don't treat loading state as a change
    if (authLoading) return;

    const currentIdentity = isAuthenticated && user?.sub ? user.sub : 'guest';
    const previousIdentity = authIdentityRef.current;

    // Initialize on first run
    if (previousIdentity === null) {
      authIdentityRef.current = currentIdentity;
      return;
    }

    // Rotate if identity changed (guest to user, user to guest, or user A to user B)
    if (previousIdentity !== currentIdentity) {
      const newThreadId = generateThreadId();
      setThreadId(newThreadId);
      persistThreadId(newThreadId);
      authIdentityRef.current = currentIdentity;
      // Clear all state
      setMessages([]);
      setHandoff(false);
      setDraft('');
      setError(null);
      persist([]);
    }
  }, [isAuthenticated, authLoading, user?.sub]);

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    persistLastActivity(now);
    
    // Also check for idle timeout on activity
    const lastCheck = lastIdleCheckRef.current;
    if (now - lastCheck > 60000) { // Check at most once per minute
      const lastActivity = loadLastActivity();
      if (now - lastActivity > IDLE_TIMEOUT_MS) {
        const newThreadId = generateThreadId();
        setThreadId(newThreadId);
        persistThreadId(newThreadId);
        setMessages([]);
        setHandoff(false);
        setDraft('');
        setError(null);
        persist([]);
      }
      lastIdleCheckRef.current = now;
    }
  }, []);

  const clearChat = useCallback(() => {
    requestIdRef.current += 1;
    const newThreadId = generateThreadId();
    setThreadId(newThreadId);
    persistThreadId(newThreadId);
    setMessages([]);
    setHandoff(false);
    setError(null);
    setDraft('');
    setIsSending(false);
    setIsOffline(false);
    persist([]);
    updateLastActivity();
  }, [updateLastActivity]);

  const sendMessage = useCallback(
    async (text: string, isRetry = false) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;
      
      // Block sending while auth is loading
      if (authLoading) return;
      
      setError(null);
      setIsOffline(false);
      updateLastActivity();

      let nextMessages: AssistantChatMessage[];
      
      if (isRetry) {
        // On retry, re-send the existing failed message (don't duplicate)
        nextMessages = messages;
      } else {
        // New message: add to history
        const userMessage: AssistantChatMessage = {
          id: makeMessageId(),
          role: 'user',
          content: trimmed,
        };
        nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
      }
      
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
          // Clear draft only on successful send
          setDraft('');
        }
        if (data?.handoff) setHandoff(true);
        updateLastActivity();
      } catch (err: any) {
        if (requestId !== requestIdRef.current) return;
        const isNetworkError = !err?.response || err?.code === 'ERR_NETWORK';
        setIsOffline(isNetworkError);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Failed to reach the assistant'
        );
        // Keep draft on error so user can retry
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSending(false);
        }
      }
    },
    [apiClient, isSending, messages, updateLastActivity, authLoading]
  );

  const value: AssistantChatContextType = {
    messages,
    isSending,
    error,
    handoff,
    threadId,
    draft,
    isOffline,
    sendMessage,
    setDraft,
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
