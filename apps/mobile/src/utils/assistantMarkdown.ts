/**
 * Lightweight markdown for assistant chat bubbles (bold, italic, bullets).
 * Intentionally small — avoids native markdown deps on Expo.
 */

export type AssistantMdInline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string };

export type AssistantMdBlock =
  | { type: 'paragraph'; inlines: AssistantMdInline[] }
  | { type: 'bullet'; inlines: AssistantMdInline[] };

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;

export function parseAssistantInline(text: string): AssistantMdInline[] {
  if (!text) return [];
  const parts: AssistantMdInline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ type: 'text', text: text.slice(last, index) });
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push({ type: 'bold', text: token.slice(2, -2) });
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      parts.push({ type: 'italic', text: token.slice(1, -1) });
    } else {
      parts.push({ type: 'text', text: token });
    }
    last = index + token.length;
  }
  if (last < text.length) {
    parts.push({ type: 'text', text: text.slice(last) });
  }
  return parts.length ? parts : [{ type: 'text', text }];
}

export function parseAssistantMarkdown(source: string): AssistantMdBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: AssistantMdBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join('\n').trim();
    paragraph = [];
    if (!text) return;
    blocks.push({ type: 'paragraph', inlines: parseAssistantInline(text) });
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({
        type: 'bullet',
        inlines: parseAssistantInline(bullet[1]),
      });
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

/** Strip markdown markers for plain-text fallback (e.g. mid typewriter). */
export function stripAssistantMarkdown(source: string): string {
  return source
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '• ');
}
