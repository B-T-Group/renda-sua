/**
 * Reads a `whatsapp_inbox_message` push payload.
 *
 * Returns the conversation id, or `null` when the payload is for another feature.
 */
export function parseWhatsAppInboxPayload(
  data: Record<string, unknown> | undefined
): string | null {
  if (!data) return null;
  if (data.type !== 'whatsapp_inbox_message') return null;
  const raw = data.conversationId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
}
