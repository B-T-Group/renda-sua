import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { fetchWhatsAppInboxMedia } from './whatsappInboxApi';
import { whatsappInboxMediaExtension } from '../utils/whatsappInboxMedia';

const cache = new Map<string, string>();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

async function persistBlob(
  messageId: string,
  blob: Blob,
  mimeType: string,
  filename: string | null
): Promise<string> {
  if (Platform.OS === 'web' || !FileSystem.cacheDirectory) {
    return URL.createObjectURL(blob);
  }
  const ext = whatsappInboxMediaExtension(filename, mimeType);
  const dest = `${FileSystem.cacheDirectory}wa-inbox-${messageId}${ext}`;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return dest;
  const base64 = await blobToBase64(blob);
  await FileSystem.writeAsStringAsync(dest, base64, { encoding: 'base64' });
  return dest;
}

export async function toShareableWhatsAppUri(uri: string): Promise<string> {
  if (Platform.OS !== 'android' || !uri.startsWith('file://')) return uri;
  return FileSystem.getContentUriAsync(uri);
}

export async function loadWhatsAppInboxMediaFile(params: {
  messageId: string;
  filename: string | null;
}): Promise<string> {
  const cached = cache.get(params.messageId);
  if (cached) return cached;
  const { blob, mimeType } = await fetchWhatsAppInboxMedia(params.messageId);
  const uri = await persistBlob(params.messageId, blob, mimeType, params.filename);
  cache.set(params.messageId, uri);
  return uri;
}
