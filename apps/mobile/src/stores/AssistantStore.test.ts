import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssistantStore } from './AssistantStore';

describe('AssistantStore', () => {
  let store: AssistantStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new AssistantStore();
  });

  afterEach(() => {
    store.dispose();
    vi.restoreAllMocks();
  });

  it('initializes with empty messages and a thread_id', () => {
    expect(store.messages).toEqual([]);
    expect(store.threadId).toBeTruthy();
    expect(store.isSending).toBe(false);
    expect(store.error).toBe(null);
    expect(store.handoff).toBe(false);
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

  it('rotates thread_id on clearChat', () => {
    const originalThreadId = store.threadId;
    store.addUserMessage('Test');
    store.clearChat();
    expect(store.messages).toEqual([]);
    expect(store.threadId).not.toBe(originalThreadId);
    expect(store.error).toBe(null);
    expect(store.handoff).toBe(false);
  });

  it('rotates thread_id after 30 minutes idle', () => {
    const originalThreadId = store.threadId;
    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(store.threadId).not.toBe(originalThreadId);
  });

  it('does not rotate thread_id before 30 minutes', () => {
    const originalThreadId = store.threadId;
    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(store.threadId).toBe(originalThreadId);
  });

  it('resets idle timer on user activity', () => {
    const originalThreadId = store.threadId;
    vi.advanceTimersByTime(29 * 60 * 1000);
    store.addUserMessage('Keep alive');
    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(store.threadId).toBe(originalThreadId);
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(store.threadId).not.toBe(originalThreadId);
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

  it('rotateThread generates a new thread_id and updates activity', () => {
    const originalThreadId = store.threadId;
    const originalActivity = store.lastActivityAt;
    vi.advanceTimersByTime(1000);
    store.rotateThread();
    expect(store.threadId).not.toBe(originalThreadId);
    expect(store.lastActivityAt).toBeGreaterThan(originalActivity);
  });
});
