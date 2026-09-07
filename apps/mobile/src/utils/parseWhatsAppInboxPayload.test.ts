import { describe, expect, it } from 'vitest';
import { parseWhatsAppInboxPayload } from './parseWhatsAppInboxPayload';

describe('parseWhatsAppInboxPayload', () => {
  it('returns the conversation id', () => {
    expect(
      parseWhatsAppInboxPayload({
        type: 'whatsapp_inbox_message',
        conversationId: ' conv-1 ',
      })
    ).toBe('conv-1');
  });

  it('returns an empty string when the alert has no conversation id', () => {
    expect(parseWhatsAppInboxPayload({ type: 'whatsapp_inbox_message' })).toBe(
      ''
    );
    expect(
      parseWhatsAppInboxPayload({
        type: 'whatsapp_inbox_message',
        conversationId: '  ',
      })
    ).toBe('');
  });

  it('ignores payloads owned by other features', () => {
    expect(parseWhatsAppInboxPayload(undefined)).toBeNull();
    expect(parseWhatsAppInboxPayload({ type: 'admin_order_risk' })).toBeNull();
    expect(
      parseWhatsAppInboxPayload({ conversationId: 'conv-1' })
    ).toBeNull();
  });
});
