export type PageSharePayload = {
  url: string;
  title: string;
  text?: string;
};

export type ShareChannel = 'whatsapp' | 'telegram' | 'x' | 'facebook' | 'linkedin' | 'email';

export function shareLine(payload: PageSharePayload): string {
  const { title, text } = payload;
  return text?.trim() ? `${title} — ${text.trim()}` : title;
}

function waHref(p: PageSharePayload): string {
  const body = `${shareLine(p)}\n${p.url}`;
  return `https://wa.me/?text=${encodeURIComponent(body)}`;
}

function tgHref(p: PageSharePayload): string {
  return `https://t.me/share/url?url=${encodeURIComponent(p.url)}&text=${encodeURIComponent(shareLine(p))}`;
}

function xHref(p: PageSharePayload): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareLine(p))}&url=${encodeURIComponent(p.url)}`;
}

function fbHref(p: PageSharePayload): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(p.url)}`;
}

function liHref(p: PageSharePayload): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(p.url)}`;
}

function mailHref(p: PageSharePayload): string {
  const body = p.text?.trim() ? `${p.text.trim()}\n\n${p.url}` : `${shareLine(p)}\n\n${p.url}`;
  return `mailto:?subject=${encodeURIComponent(p.title)}&body=${encodeURIComponent(body)}`;
}

const HREF_BY_CHANNEL: Record<ShareChannel, (p: PageSharePayload) => string> = {
  whatsapp: waHref,
  telegram: tgHref,
  x: xHref,
  facebook: fbHref,
  linkedin: liHref,
  email: mailHref,
};

export function hrefForShareChannel(channel: ShareChannel, payload: PageSharePayload): string {
  return HREF_BY_CHANNEL[channel](payload);
}
