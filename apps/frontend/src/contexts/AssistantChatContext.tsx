import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useApiClient } from '../hooks/useApiClient';
import { useMarket } from './MarketContext';
import {
  STORAGE_KEY_LAST_ACTIVITY,
  STORAGE_KEY_MESSAGES,
  STORAGE_KEY_OWNER,
  STORAGE_KEY_THREAD_ID,
} from './assistantChatStorage';
import { useSessionAuth } from './SessionAuthContext';
import { useTranslation } from 'react-i18next';
import { useAssistantLauncherAnalytics } from '../components/assistant/useAssistantLauncherAnalytics';
import {
  SITE_EVENT_ASSISTANT_CHAT_OPENED,
  SITE_EVENT_ASSISTANT_MESSAGE_SENT,
  SITE_EVENT_ASSISTANT_HANDOFF_REQUESTED,
  SITE_EVENT_ASSISTANT_ERROR_SHOWN,
} from '../hooks/useTrackSiteEvent';

export type AssistantChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ChatApiResponse = {
  reply: string;
  handoff: boolean;
  /** Contract v2 (#451 §5.2): structured tool results. Absent on today's backend. */
  blocks?: Array<{ kind?: unknown } | null> | null;
};

/** Block kinds that only come from a successful tool call (order/item/store found, reorder ready). */
const TOOL_RESULT_BLOCK_KINDS = new Set(['item', 'store', 'order', 'reorder']);

/**
 * True when a reply carried a successful tool result, which is the only trigger for
 * the character's Success state. Plain FAQ answers, link-only blocks and handoffs
 * never count.
 */
export function replyHasToolSuccess(
  data: Partial<ChatApiResponse> | null | undefined
): boolean {
  if (!data || data.handoff) return false;
  if (!Array.isArray(data.blocks)) return false;
  return data.blocks.some(
    (b) =>
      !!b && typeof b.kind === 'string' && TOOL_RESULT_BLOCK_KINDS.has(b.kind)
  );
}

export type LastAssistantReply = {
  /** Increments on every reply that lands in the thread. */
  seq: number;
  toolSuccess: boolean;
  handoff: boolean;
};

const NO_REPLY: LastAssistantReply = {
  seq: 0,
  toolSuccess: false,
  handoff: false,
};

interface AssistantChatContextType {
  messages: AssistantChatMessage[];
  isSending: boolean;
  error: string | null;
  handoff: boolean;
  threadId: string;
  draft: string;
  isOffline: boolean;
  /** False until auth has settled and the thread has been checked against its owner. */
  ready: boolean;
  /** The latest reply that landed (drives the assistant character's Responding/Success). */
  lastReply: LastAssistantReply;
  /** Appends a user message and sends the thread. Resolves false when nothing was sent. */
  sendMessage: (text: string) => Promise<boolean>;
  /** Re-sends the thread whose last user message failed, without adding a copy. */
  retry: () => Promise<boolean>;
  setDraft: (draft: string) => void;
  clearChat: () => void;
}

const AssistantChatContext = createContext<AssistantChatContextType | null>(
  null
);

export {
  STORAGE_KEY_MESSAGES,
  STORAGE_KEY_THREAD_ID,
  STORAGE_KEY_LAST_ACTIVITY,
  STORAGE_KEY_OWNER,
  clearAssistantChatStorage,
} from './assistantChatStorage';
const MAX_API_MESSAGES = 20;
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generate a UUID v4 with progressive fallbacks:
 * 1. crypto.randomUUID (modern browsers, secure contexts)
 * 2. crypto.getRandomValues (RFC 4122 v4 built from random bytes)
 * 3. Math.random (last resort; ids are not security tokens)
 */
export function generateThreadId(): string {
  const c: Crypto | undefined =
    typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      // Fall through to the next method
    }
  }
  if (c && typeof c.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
      return [
        hex.slice(0, 4).join(''),
        hex.slice(4, 6).join(''),
        hex.slice(6, 8).join(''),
        hex.slice(8, 10).join(''),
        hex.slice(10, 16).join(''),
      ].join('-');
    } catch {
      // Fall through to Math.random
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * cyrb53: small, fast, non-cryptographic 53-bit hash. It only keeps the raw id out of
 * storage and serves as an equality key; with a candidate sub anyone can confirm a match.
 */
function opaqueHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/**
 * Stable owner key for the current identity, stored instead of any PII.
 * Returns null when signed in but the user id is not known yet (e.g. a token
 * refresh without an id_token): the owner is unknown, not a guest, so the chat
 * stays locked (no restore, no send) until the sub is available.
 */
export function assistantOwnerKey(
  isAuthenticated: boolean,
  sub: string | null | undefined
): string | null {
  if (!isAuthenticated) return 'guest';
  if (!sub) return null;
  return `u:${opaqueHash(`rendasua.assistant:${sub}`)}`;
}

function readStorage(key: string): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore quota / privacy mode */
  }
}

function removeStorage(key: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function loadStoredMessages(): AssistantChatMessage[] {
  const raw = readStorage(STORAGE_KEY_MESSAGES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AssistantChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistMessages(messages: AssistantChatMessage[]): void {
  writeStorage(
    STORAGE_KEY_MESSAGES,
    JSON.stringify(messages.slice(-MAX_API_MESSAGES))
  );
}

/** True when the last recorded activity is older than the idle timeout. */
function isIdleAt(now: number): boolean {
  const raw = readStorage(STORAGE_KEY_LAST_ACTIVITY);
  if (!raw) return false;
  const last = Number(raw);
  return Number.isFinite(last) && now - last > IDLE_TIMEOUT_MS;
}

/** Axios rejects without `response` when the request never reached the server. */
function isNetworkError(err: unknown): boolean {
  const e = err as { response?: unknown; code?: string } | null;
  return !e?.response || e?.code === 'ERR_NETWORK';
}

function errorText(err: unknown): string {
  const e = err as {
    response?: { data?: { message?: unknown } };
    message?: unknown;
  } | null;
  const fromServer = e?.response?.data?.message;
  if (typeof fromServer === 'string' && fromServer) return fromServer;
  if (typeof e?.message === 'string' && e.message) return e.message;
  return 'Failed to reach the assistant';
}

function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AssistantChatProvider({ children }: { children: ReactNode }) {
  const apiClient = useApiClient();
  const { isAuthenticated, isLoading: authLoading, user } = useSessionAuth();
  const { selectedMarket } = useMarket();
  const authSettled = !authLoading;
  const owner = assistantOwnerKey(isAuthenticated, user?.sub);
  const trackEvent = useAssistantLauncherAnalytics(isAuthenticated);

  const [messages, setMessagesState] = useState<AssistantChatMessage[]>([]);
  const [threadId, setThreadIdState] = useState('');
  const [ready, setReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [draft, setDraft] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [lastReply, setLastReply] = useState<LastAssistantReply>(NO_REPLY);
  const prevHandoffRef = useRef(false);
  const prevErrorRef = useRef<string | null>(null);

  // Refs mirror state so async callbacks never act on a stale thread.
  const messagesRef = useRef<AssistantChatMessage[]>([]);
  const threadIdRef = useRef('');
  const readyRef = useRef(false);
  const isSendingRef = useRef(false);
  const requestIdRef = useRef(0);
  /** Aborts the request in flight (at most one; sending is serialised). */
  const abortRef = useRef<AbortController | null>(null);
  /** Owner the in-memory thread belongs to (null until the first settled check). */
  const ownerRef = useRef<string | null>(null);
  /** Bumped to force the owner check to run again (bfcache restore). */
  const [ownerCheck, setOwnerCheck] = useState(0);

  const commitMessages = useCallback((next: AssistantChatMessage[]) => {
    messagesRef.current = next;
    setMessagesState(next);
    persistMessages(next);
  }, []);

  const setSending = useCallback((value: boolean) => {
    isSendingRef.current = value;
    setIsSending(value);
  }, []);

  /**
   * New thread: fresh UUID, empty history, draft/error/handoff cleared, and any
   * in-flight request orphaned (its reply or error is dropped when it settles).
   */
  const rotate = useCallback(
    (nextOwner?: string) => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      const id = generateThreadId();
      threadIdRef.current = id;
      setThreadIdState(id);
      writeStorage(STORAGE_KEY_THREAD_ID, id);
      if (nextOwner !== undefined) {
        ownerRef.current = nextOwner;
        writeStorage(STORAGE_KEY_OWNER, nextOwner);
      }
      removeStorage(STORAGE_KEY_LAST_ACTIVITY);
      commitMessages([]);
      setDraft('');
      setError(null);
      setHandoff(false);
      setIsOffline(false);
      setSending(false);
    },
    [commitMessages, setSending]
  );

  // Owner check: runs on mount and whenever auth settles or the identity changes.
  // Nothing is restored (and nothing can be sent) until auth has settled and the
  // owner is known (signed in without a sub stays locked).
  useLayoutEffect(() => {
    if (!authSettled || owner === null) {
      readyRef.current = false;
      setReady(false);
      return;
    }
    if (readyRef.current && ownerRef.current === owner) return;

    const storedOwner = readStorage(STORAGE_KEY_OWNER);
    const storedThread = readStorage(STORAGE_KEY_THREAD_ID);
    const identityChangedInSession =
      ownerRef.current !== null && ownerRef.current !== owner;

    if (
      identityChangedInSession ||
      storedOwner !== owner ||
      !storedThread ||
      isIdleAt(Date.now())
    ) {
      rotate(owner);
    } else {
      ownerRef.current = owner;
      threadIdRef.current = storedThread;
      setThreadIdState(storedThread);
      const restored = loadStoredMessages();
      messagesRef.current = restored;
      setMessagesState(restored);
    }
    readyRef.current = true;
    setReady(true);
  }, [authSettled, owner, rotate, ownerCheck]);

  // Unmount: orphan and cancel the request in flight. The provider unmounts at
  // sign-in (App shows LoadingPage on /app), and a late guest reply must not
  // land in whatever thread the next instance creates.
  useEffect(
    () => () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
    },
    []
  );

  // Back/forward cache restore: React state may predate a logout or rotation
  // done by a later page. Drop it and re-run the owner check against storage.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const stale =
        readStorage(STORAGE_KEY_OWNER) !== ownerRef.current ||
        readStorage(STORAGE_KEY_THREAD_ID) !== threadIdRef.current;
      if (!stale) return;
      requestIdRef.current += 1;
      abortRef.current?.abort();
      messagesRef.current = [];
      setMessagesState([]);
      ownerRef.current = null;
      readyRef.current = false;
      setOwnerCheck((n) => n + 1);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  // Emit assistant.handoff.requested when handoff becomes true (rising edge only)
  useEffect(() => {
    if (handoff && !prevHandoffRef.current) {
      trackEvent(SITE_EVENT_ASSISTANT_HANDOFF_REQUESTED, {});
    }
    prevHandoffRef.current = handoff;
  }, [handoff, trackEvent]);

  // Emit assistant.error.shown when error is set (rising edge only)
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      const kind = isOffline ? 'network' : 'server';
      trackEvent(SITE_EVENT_ASSISTANT_ERROR_SHOWN, { kind });
    }
    prevErrorRef.current = error;
  }, [error, isOffline, trackEvent]);

  /** Rotates if the thread has been idle; must run before activity is recorded. */
  const rotateIfIdle = useCallback((): boolean => {
    if (!readyRef.current || !isIdleAt(Date.now())) return false;
    rotate();
    return true;
  }, [rotate]);

  useEffect(() => {
    const onFocus = () => {
      rotateIfIdle();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') rotateIfIdle();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [rotateIfIdle]);

  const dispatch = useCallback(
    async (history: AssistantChatMessage[]) => {
      const requestId = ++requestIdRef.current;
      const requestThreadId = threadIdRef.current;
      const requestOwner = ownerRef.current;
      const controller =
        typeof AbortController !== 'undefined' ? new AbortController() : null;
      abortRef.current = controller;
      /** This instance still owns the request (no rotation or unmount since). */
      const isOwnRequest = () =>
        requestIdRef.current === requestId &&
        threadIdRef.current === requestThreadId;
      /**
       * Safe to write: also checks storage, the source of truth shared by every
       * provider instance in the tab (another instance may have rotated it, or
       * logout may have cleared it).
       */
      const isCurrent = () =>
        isOwnRequest() &&
        readStorage(STORAGE_KEY_THREAD_ID) === requestThreadId &&
        readStorage(STORAGE_KEY_OWNER) === requestOwner;

      writeStorage(STORAGE_KEY_LAST_ACTIVITY, String(Date.now()));
      setError(null);
      setIsOffline(false);
      setSending(true);

      try {
        const payload = history.slice(-MAX_API_MESSAGES).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const body: {
          messages: typeof payload;
          market?: { country_code: string; state?: string };
          threadId?: string;
        } = { messages: payload };
        if (selectedMarket) {
          body.market = {
            country_code: selectedMarket.countryCode,
            state: selectedMarket.stateCode || undefined,
          };
        }
        if (requestThreadId) {
          body.threadId = requestThreadId;
        }
        const { data } = await apiClient.post<ChatApiResponse>(
          '/assistant/chat',
          body,
          controller ? { signal: controller.signal } : undefined
        );
        if (!isCurrent()) return;
        const reply = data?.reply?.trim() || '';
        if (reply) {
          commitMessages([
            ...messagesRef.current,
            { id: makeMessageId(), role: 'assistant', content: reply },
          ]);
          setLastReply((prev) => ({
            seq: prev.seq + 1,
            toolSuccess: replyHasToolSuccess(data),
            handoff: !!data?.handoff,
          }));
        }
        if (data?.handoff) setHandoff(true);
        writeStorage(STORAGE_KEY_LAST_ACTIVITY, String(Date.now()));
      } catch (err: unknown) {
        if (!isCurrent()) return;
        // The failed user message stays in the thread so Retry can re-send it.
        setIsOffline(isNetworkError(err));
        setError(errorText(err));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        if (isOwnRequest()) setSending(false);
      }
    },
    [apiClient, commitMessages, setSending, selectedMarket]
  );

  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed || !readyRef.current || isSendingRef.current) return false;
      rotateIfIdle();
      const next: AssistantChatMessage[] = [
        ...messagesRef.current,
        { id: makeMessageId(), role: 'user', content: trimmed },
      ];
      commitMessages(next);
      // Emit assistant.message.sent (Phase 0)
      trackEvent(SITE_EVENT_ASSISTANT_MESSAGE_SENT, {});
      await dispatch(next);
      return true;
    },
    [commitMessages, dispatch, rotateIfIdle, trackEvent]
  );

  const retry = useCallback(async (): Promise<boolean> => {
    if (!readyRef.current || isSendingRef.current) return false;
    if (rotateIfIdle()) return false;
    const history = messagesRef.current;
    if (history[history.length - 1]?.role !== 'user') return false;
    await dispatch(history);
    return true;
  }, [dispatch, rotateIfIdle]);

  const clearChat = useCallback(() => {
    rotate();
  }, [rotate]);

  const value = useMemo<AssistantChatContextType>(
    () => ({
      messages,
      isSending,
      error,
      handoff,
      threadId,
      draft,
      isOffline,
      ready,
      lastReply,
      sendMessage,
      retry,
      setDraft,
      clearChat,
    }),
    [
      messages,
      isSending,
      error,
      handoff,
      threadId,
      draft,
      isOffline,
      ready,
      lastReply,
      sendMessage,
      retry,
      clearChat,
    ]
  );

  return (
    <AssistantChatContext.Provider value={value}>
      {children}
    </AssistantChatContext.Provider>
  );
}

/** Null outside the provider (shared widgets that only need the thread id). */
export function useOptionalAssistantChat(): AssistantChatContextType | null {
  return useContext(AssistantChatContext);
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
