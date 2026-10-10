/**
 * What a settled assistant request means for the Renda character (#451 §1).
 * Success plays only when the reply carried a successful tool result (order
 * found, reorder added, item(s) or store found), never for plain FAQ answers,
 * errors or handoff. Today's API returns `{ reply, handoff }` only, so Success
 * stays dormant until the chat contract v2 `blocks[]` (eng plan §5.2) ships.
 */
import type { ReplyOutcome } from './assistantCharacterMachine';

export const TOOL_SUCCESS_BLOCK_KINDS: ReadonlySet<string> = new Set([
  'item',
  'store',
  'order',
  'rental',
  'reorder',
]);

export type AssistantReplyPayload = {
  reply?: string | null;
  handoff?: boolean | null;
  blocks?: unknown;
  cards?: unknown;
};

export function replyHasToolSuccess(data: AssistantReplyPayload | null | undefined): boolean {
  if (!data || data.handoff) return false;
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];
  const cards = Array.isArray(data.cards) ? data.cards : [];
  return [...blocks, ...cards].some((b) => {
    const kind = (b as { kind?: unknown } | null)?.kind;
    return typeof kind === 'string' && TOOL_SUCCESS_BLOCK_KINDS.has(kind);
  });
}

export function replyOutcome(data: AssistantReplyPayload | null | undefined): ReplyOutcome {
  if (data?.handoff) return 'handoff';
  return data?.reply?.trim() ? 'reply' : 'error';
}
