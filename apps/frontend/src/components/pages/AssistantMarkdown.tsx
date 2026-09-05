import { Box, Typography } from '@mui/material';
import React from 'react';

type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string };

type Block =
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'bullet'; inlines: Inline[] };

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;

function parseInline(text: string): Inline[] {
  if (!text) return [];
  const parts: Inline[] = [];
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

export function parseAssistantMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join('\n').trim();
    paragraph = [];
    if (!text) return;
    blocks.push({ type: 'paragraph', inlines: parseInline(text) });
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({ type: 'bullet', inlines: parseInline(bullet[1]) });
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

export function stripAssistantMarkdown(source: string): string {
  return source
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '• ');
}

function InlineRuns({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((part, index) => {
        if (part.type === 'bold') {
          return (
            <Box key={index} component="strong" sx={{ fontWeight: 700 }}>
              {part.text}
            </Box>
          );
        }
        if (part.type === 'italic') {
          return (
            <Box key={index} component="em" sx={{ fontStyle: 'italic' }}>
              {part.text}
            </Box>
          );
        }
        return <React.Fragment key={index}>{part.text}</React.Fragment>;
      })}
    </>
  );
}

type Props = {
  content: string;
  /** When false, strip markers and show plain text (e.g. mid typewriter). */
  rich?: boolean;
};

export function AssistantMarkdown({ content, rich = true }: Props) {
  if (!rich) {
    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
        {stripAssistantMarkdown(content)}
      </Typography>
    );
  }

  const blocks = parseAssistantMarkdown(content);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {blocks.map((block, index) => {
        if (block.type === 'bullet') {
          return (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
              }}
            >
              <Typography variant="body2" sx={{ lineHeight: 1.7, fontWeight: 700 }}>
                •
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.7, flex: 1, minWidth: 0 }}>
                <InlineRuns inlines={block.inlines} />
              </Typography>
            </Box>
          );
        }
        return (
          <Typography key={index} variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            <InlineRuns inlines={block.inlines} />
          </Typography>
        );
      })}
    </Box>
  );
}
