import { describe, expect, it } from 'vitest';
import {
  isInlineWhatsAppImage,
  isWhatsAppPlaceholderBody,
  whatsappInboxMediaExtension,
  whatsappMapsUrl,
} from './whatsappInboxMedia';

describe('whatsappInboxMedia', () => {
  it('detects placeholder bodies used for media without captions', () => {
    expect(isWhatsAppPlaceholderBody('[Image]')).toBe(true);
    expect(isWhatsAppPlaceholderBody('[Interactive reply]')).toBe(true);
    expect(isWhatsAppPlaceholderBody('Storefront')).toBe(false);
  });

  it('inlines images and stickers, not documents', () => {
    expect(
      isInlineWhatsAppImage('image', { id: 'm', mimeType: null, filename: null, caption: null, latitude: null, longitude: null })
    ).toBe(true);
    expect(
      isInlineWhatsAppImage('document', {
        id: 'd',
        mimeType: 'application/pdf',
        filename: 'a.pdf',
        caption: null,
        latitude: null,
        longitude: null,
      })
    ).toBe(false);
    expect(
      isInlineWhatsAppImage('unknown', {
        id: 's',
        mimeType: 'image/webp',
        filename: null,
        caption: null,
        latitude: null,
        longitude: null,
      })
    ).toBe(true);
  });

  it('picks a file extension from filename or mime type', () => {
    expect(whatsappInboxMediaExtension('invoice.PDF', 'application/pdf')).toBe(
      '.pdf'
    );
    expect(whatsappInboxMediaExtension(null, 'image/jpeg')).toBe('.jpg');
  });

  it('builds a maps URL for location pins', () => {
    expect(whatsappMapsUrl(4.05, 9.7)).toBe('https://maps.google.com/?q=4.05,9.7');
  });
});
