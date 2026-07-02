import { Injectable } from '@nestjs/common';
import type {
  MessageType,
  StructuredMessageCreateContext,
  StructuredMessageEnrichContext,
  StructuredMessageHandler,
} from './structured-message.types';

@Injectable()
export class StructuredMessageTypeRegistry {
  private readonly handlers = new Map<MessageType, StructuredMessageHandler>();

  register(handler: StructuredMessageHandler): void {
    this.handlers.set(handler.type, handler);
  }

  get(type: MessageType): StructuredMessageHandler | undefined {
    return this.handlers.get(type);
  }

  require(type: MessageType): StructuredMessageHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`No structured message handler registered for type: ${type}`);
    }
    return handler;
  }

  enrichForViewer(
    type: MessageType,
    payload: Record<string, unknown> | null | undefined,
    ctx: StructuredMessageEnrichContext
  ): Record<string, unknown> | null {
    if (!payload || type === 'TEXT') return null;
    const handler = this.handlers.get(type);
    if (!handler) return null;
    return handler.enrichForViewer(payload, ctx);
  }

  buildDisplayMessage(
    type: MessageType,
    ctx: StructuredMessageCreateContext
  ): string {
    if (type === 'TEXT') return '';
    const handler = this.require(type);
    return handler.buildDisplayMessage(ctx);
  }
}
