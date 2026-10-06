/**
 * Assistant chat store (MobX) — holds conversation state, thread_id, and idle timer.
 * Thread rotation: Start over, 30-min idle, or auth state change.
 */

import { makeAutoObservable } from 'mobx';

export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeThreadId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export class AssistantStore {
  messages: AssistantMessage[] = [];
  threadId: string = makeThreadId();
  lastActivityAt: number = Date.now();
  isSending: boolean = false;
  error: string | null = null;
  handoff: boolean = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  private updateActivity(): void {
    this.lastActivityAt = Date.now();
  }

  /** Check if idle timeout has elapsed and rotate if needed. Call before send or on screen focus. */
  checkAndRotateIfIdle(): void {
    if (Date.now() - this.lastActivityAt >= IDLE_TIMEOUT_MS) {
      this.rotateThread();
    }
  }

  addUserMessage(content: string): AssistantMessage {
    const msg: AssistantMessage = {
      id: makeMessageId(),
      role: 'user',
      content,
    };
    this.messages.push(msg);
    this.updateActivity();
    return msg;
  }

  addAssistantMessage(content: string): void {
    this.messages.push({
      id: makeMessageId(),
      role: 'assistant',
      content,
    });
    this.updateActivity();
  }

  setIsSending(value: boolean): void {
    this.isSending = value;
  }

  setError(error: string | null): void {
    this.error = error;
  }

  setHandoff(value: boolean): void {
    this.handoff = value;
  }

  /** Start over: clear messages + rotate thread */
  clearChat(): void {
    this.messages = [];
    this.error = null;
    this.handoff = false;
    this.isSending = false;
    this.rotateThread();
  }

  /** Rotate thread_id and clear messages (called on start over, 30-min idle, auth change) */
  rotateThread(): void {
    this.threadId = makeThreadId();
    this.messages = [];
    this.error = null;
    this.handoff = false;
    this.updateActivity();
  }
}
