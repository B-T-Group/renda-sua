/**
 * Strip model chain-of-thought / internal metadata from customer-facing replies.
 * Nova (and similar models) sometimes emit <thinking>…</thinking> despite instructions.
 */
const INTERNAL_BLOCKS =
  /<(thinking|reasoning|thought|internal|scratchpad|analysis)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

const ORPHAN_INTERNAL_TAGS =
  /<\/?(?:thinking|reasoning|thought|internal|scratchpad|analysis)\b[^>]*>/gi;

export function sanitizeAssistantReply(text: string): string {
  return text
    .replace(INTERNAL_BLOCKS, ' ')
    .replace(ORPHAN_INTERNAL_TAGS, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
