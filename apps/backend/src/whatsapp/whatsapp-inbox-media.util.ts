export interface WhatsAppInboxMediaMeta {
  id: string | null;
  mimeType: string | null;
  filename: string | null;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
}

const MEDIA_KEYS = ['image', 'audio', 'video', 'document', 'sticker'] as const;

const TYPE_LABELS: Record<string, string> = {
  image: '[Image]',
  audio: '[Audio]',
  video: '[Video]',
  document: '[Document]',
  location: '[Location]',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringField(
  obj: Record<string, unknown>,
  key: string
): string | null {
  const value = obj[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mediaBlock(
  type: string,
  payload: Record<string, unknown>
): Record<string, unknown> | null {
  const typed = MEDIA_KEYS.includes(type as (typeof MEDIA_KEYS)[number])
    ? asRecord(payload[type])
    : null;
  if (typed) return typed;
  for (const key of MEDIA_KEYS) {
    const found = asRecord(payload[key]);
    if (found) return found;
  }
  return null;
}

function locationMeta(
  loc: Record<string, unknown> | null
): WhatsAppInboxMediaMeta | null {
  if (!loc) return null;
  const latitude = typeof loc.latitude === 'number' ? loc.latitude : null;
  const longitude = typeof loc.longitude === 'number' ? loc.longitude : null;
  const name = stringField(loc, 'name') || stringField(loc, 'address');
  const caption =
    name ||
    (latitude != null && longitude != null
      ? `${latitude}, ${longitude}`
      : '[Location]');
  return {
    id: null,
    mimeType: null,
    filename: null,
    caption,
    latitude,
    longitude,
  };
}

export function inboxMediaFromPayload(
  type: string,
  raw: unknown
): WhatsAppInboxMediaMeta | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  if (type === 'location' || payload.location) {
    return locationMeta(asRecord(payload.location));
  }
  const block = mediaBlock(type, payload);
  if (!block) return null;
  return {
    id: stringField(block, 'id'),
    mimeType: stringField(block, 'mime_type'),
    filename: stringField(block, 'filename'),
    caption: stringField(block, 'caption'),
    latitude: null,
    longitude: null,
  };
}

export interface WhatsAppInboxButtonReply {
  buttonId: string;
  buttonTitle: string;
  preview: string;
}

function formatButtonPreview(title: string, id: string): string {
  if (title && id && title !== id) return `${title} (${id})`;
  return title || id;
}

function templateButtonReply(
  payload: Record<string, unknown>
): WhatsAppInboxButtonReply | null {
  const button = asRecord(payload.button);
  if (!button) return null;
  const title = stringField(button, 'text') || '';
  const id = stringField(button, 'payload') || title;
  if (!title && !id) return null;
  return {
    buttonId: id,
    buttonTitle: title,
    preview: formatButtonPreview(title, id),
  };
}

function interactiveButtonReply(
  payload: Record<string, unknown>
): WhatsAppInboxButtonReply | null {
  const interactive = asRecord(payload.interactive);
  const reply =
    asRecord(interactive?.button_reply) || asRecord(interactive?.list_reply);
  if (!reply) return null;
  const title = stringField(reply, 'title') || '';
  const id = stringField(reply, 'id') || title;
  if (!title && !id) return null;
  return {
    buttonId: id,
    buttonTitle: title,
    preview: formatButtonPreview(title, id),
  };
}

export function inboxButtonReplyFromPayload(
  raw: unknown
): WhatsAppInboxButtonReply | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  return templateButtonReply(payload) || interactiveButtonReply(payload);
}

export function inboxAttachmentPreview(type: string, raw: unknown): string {
  const reply = inboxButtonReplyFromPayload(raw);
  if (reply) return reply.preview;
  const media = inboxMediaFromPayload(type, raw);
  if (media?.caption) return media.caption;
  if (media?.filename) return media.filename;
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  if (asRecord(raw)?.sticker) return '[Sticker]';
  return `[${type}]`;
}

export function inboxDisplayMessage(
  type: string,
  storedBody: string,
  raw: unknown
): { type: string; body: string } {
  const reply = inboxButtonReplyFromPayload(raw);
  if (reply) return { type: 'text', body: reply.preview };
  return { type, body: storedBody };
}

export function mediaContentDisposition(filename: string | null): string | null {
  if (!filename) return null;
  const safe = filename.replace(/[\r\n"]/g, '_');
  return `inline; filename="${safe}"`;
}
