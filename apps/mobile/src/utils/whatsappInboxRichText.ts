export type WhatsAppRichSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  mono?: boolean;
  url?: string;
};

const URL_RE = /https?:\/\/[^\s]+/gi;
const FORMAT_RE =
  /```([\s\S]*?)```|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;

function splitTrailingPunctuation(raw: string): { href: string; extra: string } {
  const href = raw.replace(/[),.;!?]+$/g, '');
  return { href, extra: raw.slice(href.length) };
}

function displayUrl(href: string): string {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

function formattedSegment(match: RegExpExecArray): WhatsAppRichSegment {
  if (match[1] != null) return { text: match[1], mono: true };
  if (match[2] != null) return { text: match[2], bold: true };
  if (match[3] != null) return { text: match[3], italic: true };
  return { text: match[4] ?? '', strike: true };
}

function parseWhatsAppFormatted(text: string): WhatsAppRichSegment[] {
  const out: WhatsAppRichSegment[] = [];
  let last = 0;
  FORMAT_RE.lastIndex = 0;
  let match: RegExpExecArray | null = FORMAT_RE.exec(text);
  while (match) {
    if (match.index > last) out.push({ text: text.slice(last, match.index) });
    out.push(formattedSegment(match));
    last = match.index + match[0].length;
    match = FORMAT_RE.exec(text);
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}

export function parseWhatsAppRichText(input: string): WhatsAppRichSegment[] {
  const parts: WhatsAppRichSegment[] = [];
  URL_RE.lastIndex = 0;
  let last = 0;
  let match: RegExpExecArray | null = URL_RE.exec(input);
  while (match) {
    if (match.index > last) {
      parts.push(...parseWhatsAppFormatted(input.slice(last, match.index)));
    }
    const { href, extra } = splitTrailingPunctuation(match[0]);
    parts.push({ text: displayUrl(href), url: href });
    if (extra) parts.push(...parseWhatsAppFormatted(extra));
    last = match.index + match[0].length;
    match = URL_RE.exec(input);
  }
  if (last < input.length) {
    parts.push(...parseWhatsAppFormatted(input.slice(last)));
  }
  return parts.length ? parts : [{ text: input }];
}
