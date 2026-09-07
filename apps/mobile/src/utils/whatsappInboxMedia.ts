import type { WhatsAppInboxMedia } from '../types/whatsappInbox';

export function isWhatsAppPlaceholderBody(body: string): boolean {
  return /^\[[A-Za-z ]+\]$/.test(body.trim());
}

export function isInlineWhatsAppImage(
  type: string,
  media: WhatsAppInboxMedia | null
): boolean {
  if (!media?.id) return false;
  if (media.mimeType?.startsWith('image/')) return true;
  if (media.mimeType) return false;
  return type === 'image' || type === 'sticker';
}

export function whatsappInboxMediaExtension(
  filename: string | null,
  mimeType: string
): string {
  const fromName = filename?.match(/(\.[A-Za-z0-9]+)$/)?.[1];
  if (fromName) return fromName.toLowerCase();
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
  if (mimeType.includes('png')) return '.png';
  if (mimeType.includes('webp')) return '.webp';
  if (mimeType.includes('pdf')) return '.pdf';
  if (mimeType.includes('mp4')) return '.mp4';
  if (mimeType.includes('ogg') || mimeType.includes('opus')) return '.ogg';
  if (mimeType.includes('mpeg')) return '.mp3';
  return '';
}

export function whatsappMapsUrl(
  latitude: number,
  longitude: number
): string {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}
