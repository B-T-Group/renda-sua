import { useCallback, useEffect, useState } from 'react';
import { loadWhatsAppInboxMediaFile } from '../services/whatsappInboxMediaCache';
import type { WhatsAppInboxMessage } from '../types/whatsappInbox';
import { isInlineWhatsAppImage } from '../utils/whatsappInboxMedia';

export function useWhatsAppInboxMedia(message: WhatsAppInboxMessage) {
  const media = message.media;
  const inline = isInlineWhatsAppImage(message.type, media);
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<string | null> => {
    if (!media?.id) return null;
    setLoading(true);
    setError(null);
    try {
      const next = await loadWhatsAppInboxMediaFile({
        messageId: message.id,
        filename: media.filename,
      });
      setUri(next);
      return next;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [media?.filename, media?.id, message.id]);

  useEffect(() => {
    if (inline) void load();
  }, [inline, load]);

  return { uri, loading, error, load, inline, media };
}
