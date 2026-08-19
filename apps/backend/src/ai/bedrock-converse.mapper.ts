import axios from 'axios';
import type { ChatCompletionMessage } from './chat-completion.types';
import { fitImageBytesForBedrockConverse } from './bedrock-converse-image';

export type ConverseImageFormat = 'png' | 'jpeg' | 'gif' | 'webp';

export type ConverseContentBlock =
  | { text: string }
  | { image: { format: ConverseImageFormat; source: { bytes: Uint8Array } } };

export type ConverseMessage = {
  role: 'user' | 'assistant';
  content: ConverseContentBlock[];
};

export type MappedConverseRequest = {
  system?: Array<{ text: string }>;
  messages: ConverseMessage[];
};

/** Above the 10MB ID / product upload cap so allowed photos are not dropped. */
const IMAGE_FETCH_MAX_BYTES = 12 * 1024 * 1024;

/**
 * Map OpenAI-style chat messages to Bedrock Converse (Nova) shape.
 * System → `system`; user/assistant → `messages` with text/image blocks.
 */
export async function mapChatMessagesToConverse(
  messages: ChatCompletionMessage[],
  opts?: { jsonObject?: boolean }
): Promise<MappedConverseRequest> {
  const systemText = buildSystemText(messages, opts?.jsonObject);
  const mapped: ConverseMessage[] = [];
  for (const message of messages) {
    if (message.role === 'system') continue;
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const content = await mapContent(message.content);
    if (!content.length) continue;
    appendOrMerge(mapped, role, content);
  }
  if (!mapped.length) {
    mapped.push({ role: 'user', content: [{ text: '' }] });
  }
  return systemText
    ? { system: [{ text: systemText }], messages: mapped }
    : { messages: mapped };
}

export function extractConverseOutputText(output: unknown): string {
  if (!output || typeof output !== 'object') return '';
  const message = (output as { message?: { content?: unknown[] } }).message;
  if (!Array.isArray(message?.content)) return '';
  const chunks: string[] = [];
  for (const part of message.content) {
    if (!part || typeof part !== 'object') continue;
    const text = (part as { text?: unknown }).text;
    if (typeof text === 'string' && text.trim()) chunks.push(text);
  }
  return stripCodeFences(chunks.join('\n'));
}

export function stripCodeFences(input: string): string {
  const trimmed = input.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

function buildSystemText(
  messages: ChatCompletionMessage[],
  jsonObject?: boolean
): string {
  const parts = messages
    .filter((m) => m.role === 'system')
    .map((m) => contentToPlainText(m.content))
    .filter(Boolean);
  if (jsonObject) {
    parts.push(
      'Respond with a single valid JSON object only. No markdown fences or commentary.'
    );
  }
  return parts.join('\n\n');
}

function appendOrMerge(
  mapped: ConverseMessage[],
  role: 'user' | 'assistant',
  content: ConverseContentBlock[]
): void {
  const last = mapped[mapped.length - 1];
  if (last?.role === role) {
    last.content.push(...content);
    return;
  }
  mapped.push({ role, content });
}

async function mapContent(content: unknown): Promise<ConverseContentBlock[]> {
  if (typeof content === 'string') {
    return content ? [{ text: content }] : [];
  }
  if (!Array.isArray(content)) {
    const text = String(content ?? '');
    return text ? [{ text }] : [];
  }
  const blocks: ConverseContentBlock[] = [];
  for (const part of content) {
    await pushPart(blocks, part);
  }
  return blocks;
}

async function pushPart(
  blocks: ConverseContentBlock[],
  part: unknown
): Promise<void> {
  if (!part || typeof part !== 'object') return;
  const rec = part as Record<string, unknown>;
  if (rec.type === 'text' && typeof rec.text === 'string' && rec.text) {
    blocks.push({ text: rec.text });
    return;
  }
  if (rec.type === 'image_url') {
    blocks.push(await requireImageBlock(rec.image_url));
  }
}

/** Fail closed: never send a vision prompt after dropping a provided image. */
async function requireImageBlock(
  imageUrl: unknown
): Promise<ConverseContentBlock> {
  const url = extractImageUrl(imageUrl);
  if (!url) {
    throw new Error('Vision request is missing an image URL');
  }
  if (url.startsWith('data:')) {
    return parseRequiredDataUrlImage(url);
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return fetchHttpImage(url);
  }
  throw new Error('Vision request image URL must be http(s) or a data URL');
}

function extractImageUrl(imageUrl: unknown): string | null {
  if (typeof imageUrl === 'string' && imageUrl.trim()) return imageUrl.trim();
  if (imageUrl && typeof imageUrl === 'object') {
    const url = (imageUrl as { url?: unknown }).url;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }
  return null;
}

async function parseRequiredDataUrlImage(
  dataUrl: string
): Promise<ConverseContentBlock> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  const format = match ? mimeToFormat(match[1]) : null;
  if (!match || !format) {
    throw new Error('Vision request has an invalid data-URL image');
  }
  return toFittedImageBlock(Buffer.from(match[2], 'base64'), format);
}

async function fetchHttpImage(url: string): Promise<ConverseContentBlock> {
  try {
    return await downloadHttpImage(url);
  } catch (error: any) {
    throw new Error(
      `Failed to load vision image: ${error?.message ?? 'unknown error'}`
    );
  }
}

async function downloadHttpImage(url: string): Promise<ConverseContentBlock> {
  const { data, headers } = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 25000,
    maxContentLength: IMAGE_FETCH_MAX_BYTES,
    maxBodyLength: IMAGE_FETCH_MAX_BYTES,
    validateStatus: (s) => s === 200,
  });
  if (!data || new Uint8Array(data).byteLength === 0) {
    throw new Error('empty image body');
  }
  const mime = headers['content-type']?.split(';')[0]?.trim() || 'image/jpeg';
  const format = mimeToFormat(mime) || guessFormatFromUrl(url) || 'jpeg';
  return toFittedImageBlock(new Uint8Array(data), format);
}

async function toFittedImageBlock(
  bytes: Uint8Array,
  format: ConverseImageFormat
): Promise<ConverseContentBlock> {
  const fitted = await fitImageBytesForBedrockConverse(bytes, format);
  return {
    image: { format: fitted.format, source: { bytes: fitted.bytes } },
  };
}

function mimeToFormat(mime: string): ConverseImageFormat | null {
  const normalized = mime.toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpeg';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('webp')) return 'webp';
  return null;
}

function guessFormatFromUrl(url: string): ConverseImageFormat | null {
  const lower = url.toLowerCase();
  if (lower.includes('.png')) return 'png';
  if (lower.includes('.webp')) return 'webp';
  if (lower.includes('.gif')) return 'gif';
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'jpeg';
  return null;
}

function contentToPlainText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const rec = part as Record<string, unknown>;
      return typeof rec.text === 'string' ? rec.text : '';
    })
    .filter(Boolean)
    .join('\n');
}
