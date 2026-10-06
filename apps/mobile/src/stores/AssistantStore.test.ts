import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AssistantStore,
  classifyAssistantError,
  type AssistantChatTransport,
} from './AssistantStore';

type Reply = Awaited<ReturnType<AssistantChatTransport>>;

/** Transport whose responses the test resolves or rejects by hand. */
function controllableTransport() {
  const calls: Array<{
    messages: Parameters<AssistantChatTransport>[0];
    resolve: (value: Reply) => void;
    reject: (error: unknown) => void;
  }> = [];
  const transport: AssistantChatTransport = (messages) =>
    new Promise<Reply>((resolve, reject) => {
      calls.push({ messages, resolve, reject });
    });
  return { transport, calls };
}

// UUID v4 regex pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
// where y is [89ab] (variant bits)
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('AssistantStore', () => {
  let store: AssistantStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new AssistantStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes with empty messages and a thread_id', () => {
    expect(store.messages).toEqual([]);
    expect(store.threadId).toBeTruthy();
    expect(store.isSending).toBe(false);
    expect(store.error).toBe(null);
    expect(store.handoff).toBe(false);
  });

  it('generates thread_id as a valid UUID v4', () => {
    expect(store.threadId).toMatch(UUID_V4_REGEX);
    
    // Test multiple rotations to ensure format consistency
    const threadIds = new Set<string>();
    threadIds.add(store.threadId);
    
    for (let i = 0; i < 5; i++) {
      store.rotateThread();
      expect(store.threadId).toMatch(UUID_V4_REGEX);
      threadIds.add(store.threadId);
    }
    
    // Ensure all generated IDs are unique
    expect(threadIds.size).toBe(6);
  });

  it('adds user messages', () => {
    const msg = store.addUserMessage('Hello');
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0]).toEqual(msg);
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
  });

  it('adds assistant messages', () => {
    store.addAssistantMessage('Hi there!');
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0].role).toBe('assistant');
    expect(store.messages[0].content).toBe('Hi there!');
  });

  describe('thread rotation', () => {
    it('rotates thread_id and clears messages on clearChat (Start over)', () => {
      const originalThreadId = store.threadId;
      store.addUserMessage('Test message');
      store.addAssistantMessage('Response');
      expect(store.messages).toHaveLength(2);

      store.clearChat();

      expect(store.messages).toEqual([]);
      expect(store.threadId).not.toBe(originalThreadId);
      expect(store.error).toBe(null);
      expect(store.handoff).toBe(false);
    });

    it('rotates thread_id and clears messages on rotateThread (sign-in/sign-out)', () => {
      const originalThreadId = store.threadId;
      store.addUserMessage('Before rotation');
      store.addAssistantMessage('Response');
      store.setError('Some error');
      store.setHandoff(true);
      expect(store.messages).toHaveLength(2);

      store.rotateThread();

      expect(store.threadId).not.toBe(originalThreadId);
      expect(store.messages).toEqual([]);
      expect(store.error).toBe(null);
      expect(store.handoff).toBe(false);
    });

    it('does not rotate before 30 minutes elapsed', () => {
      const originalThreadId = store.threadId;
      store.addUserMessage('Test');
      expect(store.messages).toHaveLength(1);

      vi.advanceTimersByTime(29 * 60 * 1000);
      store.checkAndRotateIfIdle();

      expect(store.threadId).toBe(originalThreadId);
      expect(store.messages).toHaveLength(1);
    });

    it('rotates thread_id and clears messages after 30 minutes idle', () => {
      const originalThreadId = store.threadId;
      store.addUserMessage('Old message');
      store.addAssistantMessage('Old response');
      expect(store.messages).toHaveLength(2);

      vi.advanceTimersByTime(30 * 60 * 1000);
      store.checkAndRotateIfIdle();

      expect(store.threadId).not.toBe(originalThreadId);
      expect(store.messages).toEqual([]);
    });

    it('resets idle timer on user activity', () => {
      const originalThreadId = store.threadId;
      vi.advanceTimersByTime(29 * 60 * 1000);
      
      store.addUserMessage('Keep alive');
      
      vi.advanceTimersByTime(29 * 60 * 1000);
      store.checkAndRotateIfIdle();
      
      expect(store.threadId).toBe(originalThreadId);
      expect(store.messages).toHaveLength(1);

      vi.advanceTimersByTime(2 * 60 * 1000);
      store.checkAndRotateIfIdle();
      
      expect(store.threadId).not.toBe(originalThreadId);
      expect(store.messages).toEqual([]);
    });
  });

  it('tracks sending state', () => {
    expect(store.isSending).toBe(false);
    store.setIsSending(true);
    expect(store.isSending).toBe(true);
    store.setIsSending(false);
    expect(store.isSending).toBe(false);
  });

  it('tracks error state', () => {
    expect(store.error).toBe(null);
    store.setError('Network error');
    expect(store.error).toBe('Network error');
    store.setError(null);
    expect(store.error).toBe(null);
  });

  it('tracks handoff state', () => {
    expect(store.handoff).toBe(false);
    store.setHandoff(true);
    expect(store.handoff).toBe(true);
  });

  it('rotateThread generates a new thread_id, clears messages, and updates activity', () => {
    const originalThreadId = store.threadId;
    const originalActivity = store.lastActivityAt;
    store.addUserMessage('Message 1');
    store.addAssistantMessage('Message 2');
    
    vi.advanceTimersByTime(1000);
    store.rotateThread();
    
    expect(store.threadId).not.toBe(originalThreadId);
    expect(store.messages).toEqual([]);
    expect(store.lastActivityAt).toBeGreaterThan(originalActivity);
  });

  describe('send, retry and in-flight requests', () => {
    it('sends the history and appends the reply', async () => {
      const { transport, calls } = controllableTransport();
      const sent = store.sendMessage('  Where are you?  ', transport);
      expect(store.isSending).toBe(true);
      expect(calls[0].messages).toEqual([{ role: 'user', content: 'Where are you?' }]);

      calls[0].resolve({ reply: ' Douala ', handoff: true });
      await sent;

      expect(store.messages.map((m) => [m.role, m.content])).toEqual([
        ['user', 'Where are you?'],
        ['assistant', 'Douala'],
      ]);
      expect(store.handoff).toBe(true);
      expect(store.isSending).toBe(false);
    });

    it('retry re-sends the failed message once instead of appending a copy', async () => {
      const { transport, calls } = controllableTransport();
      const first = store.sendMessage('Hello', transport);
      calls[0].reject(new TypeError('Network request failed'));
      await first;

      expect(store.error).toBe('Network request failed');
      expect(store.errorKind).toBe('network');
      expect(store.failedMessageId).toBe(store.messages[0].id);
      expect(store.isSending).toBe(false);

      const retry = store.retryFailed(transport);
      // Marked as retrying: error cleared, sending, still a single user bubble.
      expect(store.error).toBe(null);
      expect(store.failedMessageId).toBe(null);
      expect(store.isSending).toBe(true);
      expect(store.messages).toHaveLength(1);
      expect(calls[1].messages).toEqual([{ role: 'user', content: 'Hello' }]);

      calls[1].resolve({ reply: 'Hi!' });
      await retry;

      expect(store.messages.map((m) => m.content)).toEqual(['Hello', 'Hi!']);
      expect(store.messages.filter((m) => m.role === 'user')).toHaveLength(1);
    });

    it('retry is a no-op when nothing failed', async () => {
      const { transport, calls } = controllableTransport();
      expect(await store.retryFailed(transport)).toBe(false);
      expect(calls).toHaveLength(0);
    });

    it('drops a late reply after rotation and does not leave isSending stuck', async () => {
      const { transport, calls } = controllableTransport();
      const sent = store.sendMessage('Signed-in question', transport);
      const threadBefore = store.threadId;

      store.rotateThread(); // e.g. sign-out while the request is in flight

      expect(store.threadId).not.toBe(threadBefore);
      expect(store.isSending).toBe(false);
      expect(store.messages).toEqual([]);

      calls[0].resolve({ reply: 'Your order #123 is on the way', handoff: true });
      await sent;

      expect(store.messages).toEqual([]);
      expect(store.handoff).toBe(false);
      expect(store.isSending).toBe(false);
    });

    it('drops a late error after Start over', async () => {
      const { transport, calls } = controllableTransport();
      const sent = store.sendMessage('Hello', transport);

      store.clearChat();
      calls[0].reject(new Error('Internal server error'));
      await sent;

      expect(store.error).toBe(null);
      expect(store.errorKind).toBe(null);
      expect(store.failedMessageId).toBe(null);
      expect(store.isSending).toBe(false);
    });

    it('an orphaned request settling does not end the next request', async () => {
      const { transport, calls } = controllableTransport();
      const orphan = store.sendMessage('Old thread', transport);
      store.rotateThread();

      const current = store.sendMessage('New thread', transport);
      expect(store.isSending).toBe(true);
      expect(calls[1].messages).toEqual([{ role: 'user', content: 'New thread' }]);

      calls[0].resolve({ reply: 'Late reply' });
      await orphan;
      expect(store.isSending).toBe(true);
      expect(store.messages.map((m) => m.content)).toEqual(['New thread']);

      calls[1].resolve({ reply: 'Fresh reply' });
      await current;
      expect(store.isSending).toBe(false);
      expect(store.messages.map((m) => m.content)).toEqual(['New thread', 'Fresh reply']);
    });

    it('ignores a send while a request is in flight', async () => {
      const { transport, calls } = controllableTransport();
      const first = store.sendMessage('One', transport);
      expect(await store.sendMessage('Two', transport)).toBe(false);
      expect(calls).toHaveLength(1);
      calls[0].resolve({ reply: 'ok' });
      await first;
      expect(store.messages.map((m) => m.content)).toEqual(['One', 'ok']);
    });

    it('rotates an idle thread before sending', async () => {
      const { transport, calls } = controllableTransport();
      store.addUserMessage('Old message');
      const threadBefore = store.threadId;
      vi.advanceTimersByTime(30 * 60 * 1000);

      const sent = store.sendMessage('Fresh start', transport);
      expect(store.threadId).not.toBe(threadBefore);
      expect(calls[0].messages).toEqual([{ role: 'user', content: 'Fresh start' }]);
      calls[0].resolve({ reply: 'Hi' });
      await sent;
    });
  });

  describe('classifyAssistantError', () => {
    it('treats fetch TypeErrors and network messages as network errors', () => {
      expect(classifyAssistantError(new TypeError('Network request failed'))).toBe('network');
      expect(classifyAssistantError(new Error('Failed to fetch'))).toBe('network');
      expect(classifyAssistantError(new Error('Request timed out'))).toBe('network');
    });

    it('treats HTTP and unknown errors as server errors', () => {
      const http = Object.assign(new Error('Too many requests'), { status: 429 });
      expect(classifyAssistantError(http)).toBe('server');
      expect(classifyAssistantError(new Error('Internal Server Error'))).toBe('server');
      expect(classifyAssistantError(undefined)).toBe('server');
    });
  });
});
