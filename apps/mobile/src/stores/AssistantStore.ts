/**
 * Assistant chat store (MobX) — holds conversation state, thread_id and the in-flight request.
 * Thread rotation: Start over, 30-min idle (checked lazily), or auth state change.
 */

import { makeAutoObservable } from 'mobx';
import { randomUUID } from '../utils/uuid';

export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

/** `network` = the request never reached the server (offline, DNS, timeout). */
export type AssistantErrorKind = 'network' | 'server';

/** Sends the chat history; injected so the store stays testable without the API client. */
export type AssistantChatTransport = (
  messages: Array<Pick<AssistantMessage, 'role' | 'content'>>
) => Promise<{ reply?: string | null; handoff?: boolean | null }>;

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const MAX_API_MESSAGES = 20;

const NETWORK_ERROR_MESSAGE = /network request failed|failed to fetch|network ?error|timed? ?out|aborted/i;

/** Network failures surface as a TypeError (RN fetch) with no HTTP status attached. */
export function classifyAssistantError(error: unknown): AssistantErrorKind {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number') return 'server';
  if (error instanceof TypeError) return 'network';
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && NETWORK_ERROR_MESSAGE.test(message)
    ? 'network'
    : 'server';
}

function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeThreadId(): string {
  return randomUUID();
}

export class AssistantStore {
  messages: AssistantMessage[] = [];
  threadId: string = makeThreadId();
  lastActivityAt: number = Date.now();
  isSending: boolean = false;
  error: string | null = null;
  errorKind: AssistantErrorKind | null = null;
  /** User message whose send failed; Retry re-sends the history that already contains it. */
  failedMessageId: string | null = null;
  handoff: boolean = false;

  private requestSeq = 0;
  /** Id of the request whose completion may still update this thread. */
  private activeRequestId: number | null = null;

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
    if (error === null) {
      this.errorKind = null;
    }
  }

  setHandoff(value: boolean): void {
    this.handoff = value;
  }

  /** Start over: clear messages + rotate thread */
  clearChat(): void {
    this.rotateThread();
  }

  /**
   * Rotate thread_id and reset the conversation (start over, 30-min idle, auth change).
   * Any in-flight request is orphaned: its reply or error is dropped when it settles.
   */
  rotateThread(): void {
    this.threadId = makeThreadId();
    this.messages = [];
    this.error = null;
    this.errorKind = null;
    this.failedMessageId = null;
    this.handoff = false;
    this.isSending = false;
    this.activeRequestId = null;
    this.updateActivity();
  }

  /** Append a user message and send it. Returns false when nothing was sent. */
  async sendMessage(text: string, transport: AssistantChatTransport): Promise<boolean> {
    this.checkAndRotateIfIdle();
    const content = text.trim();
    if (!content || this.isSending) return false;
    this.addUserMessage(content);
    await this.dispatch(transport);
    return true;
  }

  /** Re-send the failed message in place (no second copy). Returns false when nothing was sent. */
  async retryFailed(transport: AssistantChatTransport): Promise<boolean> {
    this.checkAndRotateIfIdle();
    if (this.isSending || !this.failedMessageId) return false;
    if (!this.messages.some((m) => m.id === this.failedMessageId)) {
      this.failedMessageId = null;
      return false;
    }
    await this.dispatch(transport);
    return true;
  }

  private async dispatch(transport: AssistantChatTransport): Promise<void> {
    const requestId = this.beginRequest();
    const threadId = this.threadId;
    const payload = this.messages
      .slice(-MAX_API_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content }));
    try {
      const data = await transport(payload);
      this.applyReply(requestId, threadId, data);
    } catch (error) {
      this.applyFailure(requestId, threadId, error);
    } finally {
      this.endRequest(requestId);
    }
  }

  private beginRequest(): number {
    const requestId = ++this.requestSeq;
    this.activeRequestId = requestId;
    this.isSending = true;
    this.error = null;
    this.errorKind = null;
    this.failedMessageId = null;
    return requestId;
  }

  /** True only if the request is still the active one on the same thread. */
  private isCurrent(requestId: number, threadId: string): boolean {
    return this.activeRequestId === requestId && this.threadId === threadId;
  }

  private applyReply(
    requestId: number,
    threadId: string,
    data: Awaited<ReturnType<AssistantChatTransport>>
  ): void {
    if (!this.isCurrent(requestId, threadId)) return;
    const reply = data?.reply?.trim();
    if (reply) this.addAssistantMessage(reply);
    if (data?.handoff) this.handoff = true;
  }

  private applyFailure(requestId: number, threadId: string, error: unknown): void {
    if (!this.isCurrent(requestId, threadId)) return;
    const message = (error as { message?: unknown } | null)?.message;
    this.error = typeof message === 'string' && message ? message : 'Failed to reach the assistant';
    this.errorKind = classifyAssistantError(error);
    const lastUser = [...this.messages].reverse().find((m) => m.role === 'user');
    this.failedMessageId = lastUser?.id ?? null;
  }

  private endRequest(requestId: number): void {
    if (this.activeRequestId !== requestId) return;
    this.activeRequestId = null;
    this.isSending = false;
  }
}
