import { Box, Link, Typography } from '@mui/material';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrackSiteEvent } from '../../hooks/useTrackSiteEvent';

type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'link'; text: string; url: string };

type Block =
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'bullet'; inlines: Inline[] };

const INLINE_RE = /(\[([^\]]+)\]\(([^)]+)\)|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;

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
    
    // Check for [text](url) link
    if (token.startsWith('[')) {
      const linkText = match[2];
      const url = match[3];
      if (linkText && url) {
        parts.push({ type: 'link', text: linkText, url });
      } else {
        parts.push({ type: 'text', text: token });
      }
    } else if (token.startsWith('**') && token.endsWith('**')) {
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
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '• ');
}

function InlineRuns({ inlines }: { inlines: Inline[] }) {
  const navigate = useNavigate();
  const { trackSiteEvent } = useTrackSiteEvent();

  const handleLinkClick = useCallback((e: React.MouseEvent, url: string) => {
    e.preventDefault();
    void trackSiteEvent({
      eventType: 'assistant.deeplink.tap',
      metadata: { url },
    });

    // Try in-app navigation for relative paths
    if (url.startsWith('/')) {
      navigate(url);
      return;
    }

    // Check if absolute URL is same-origin (or *.rendasua.com)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const urlObj = new URL(url);
        const currentOrigin = window.location.origin;
        const isSameOrigin = urlObj.origin === currentOrigin;
        const isRendasuaDomain = urlObj.hostname.endsWith('.rendasua.com') || urlObj.hostname === 'rendasua.com';
        
        if (isSameOrigin || isRendasuaDomain) {
          // Same origin or Rendasua domain - navigate in-app to pathname + search
          navigate(urlObj.pathname + urlObj.search);
          return;
        }
      } catch {
        // Invalid URL - fall through to external open
      }
      
      // External URLs open in new tab
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    // Relative URLs navigate
    navigate(url);
  }, [navigate, trackSiteEvent]);

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
        if (part.type === 'link') {
          return (
            <Link
              key={index}
              href={part.url}
              onClick={(e) => handleLinkClick(e, part.url)}
              sx={{
                color: 'primary.main',
                textDecorationColor: 'primary.main',
                cursor: 'pointer',
                '&:hover': {
                  textDecorationColor: 'primary.dark',
                },
              }}
            >
              {part.text}
            </Link>
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
