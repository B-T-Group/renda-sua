import { describe, expect, it } from 'vitest';
import { parseWhatsAppRichText } from './whatsappInboxRichText';

describe('parseWhatsAppRichText', () => {
  it('renders WhatsApp bold, italic, strike, and monospace', () => {
    expect(parseWhatsAppRichText('*Hello* _world_ ~old~ ```code```')).toEqual([
      { text: 'Hello', bold: true },
      { text: ' ' },
      { text: 'world', italic: true },
      { text: ' ' },
      { text: 'old', strike: true },
      { text: ' ' },
      { text: 'code', mono: true },
    ]);
  });

  it('makes https links tappable and decodes WhatsApp Manager URLs', () => {
    const href =
      'https://business.facebook.com/latest/whatsapp%5Fmanager/setup_guidance';
    const parts = parseWhatsAppRichText(`Go here: ${href}.`);
    expect(parts).toContainEqual({
      text: 'https://business.facebook.com/latest/whatsapp_manager/setup_guidance',
      url: href,
    });
    expect(parts.at(-1)).toEqual({ text: '.' });
  });

  it('parses the Meta setup-guidance nudge', () => {
    const body =
      "*Continue setting up your account*\nYou have a few steps left in *WhatsApp Manager's* new *Setup guidance*.\nhttps://business.facebook.com/latest/whatsapp%5Fmanager/setup%5Fguidance?lang=en_US";
    const parts = parseWhatsAppRichText(body);
    expect(parts[0]).toEqual({
      text: 'Continue setting up your account',
      bold: true,
    });
    expect(parts.some((p) => p.bold && p.text === "WhatsApp Manager's")).toBe(
      true
    );
    expect(parts.some((p) => p.bold && p.text === 'Setup guidance')).toBe(true);
    expect(parts.some((p) => p.url?.includes('setup%5Fguidance'))).toBe(true);
  });
});
