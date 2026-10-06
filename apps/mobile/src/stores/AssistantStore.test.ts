import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssistantStore } from './AssistantStore';

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
});
