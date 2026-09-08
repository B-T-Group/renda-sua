import { isWhatsAppAssistantInquiry } from './is-whatsapp-assistant-inquiry';

describe('isWhatsAppAssistantInquiry', () => {
  it('skips automated / away messages', () => {
    expect(
      isWhatsAppAssistantInquiry(
        'Thank you for contacting us. This is an automated message.'
      )
    ).toBe(false);
    expect(
      isWhatsAppAssistantInquiry(
        'Merci de nous avoir contacté. Ceci est un message automatique.'
      )
    ).toBe(false);
    expect(
      isWhatsAppAssistantInquiry('We have received your order and will process it.')
    ).toBe(false);
    expect(
      isWhatsAppAssistantInquiry('Votre commande a bien été reçue.')
    ).toBe(false);
    expect(
      isWhatsAppAssistantInquiry("We'll get back to you shortly during business hours.")
    ).toBe(false);
    expect(
      isWhatsAppAssistantInquiry('Nous sommes actuellement absents.')
    ).toBe(false);
  });

  it('skips acknowledgements and emoji-only', () => {
    expect(isWhatsAppAssistantInquiry('ok')).toBe(false);
    expect(isWhatsAppAssistantInquiry('Thanks!')).toBe(false);
    expect(isWhatsAppAssistantInquiry('merci')).toBe(false);
    expect(isWhatsAppAssistantInquiry('👍')).toBe(false);
    expect(isWhatsAppAssistantInquiry('🙏🙏')).toBe(false);
  });

  it('passes real customer inquiries', () => {
    expect(
      isWhatsAppAssistantInquiry('do you do pay at delivery?')
    ).toBe(true);
    expect(isWhatsAppAssistantInquiry('où est ma commande?')).toBe(true);
    expect(
      isWhatsAppAssistantInquiry('Where is my order')
    ).toBe(true);
    expect(
      isWhatsAppAssistantInquiry('Which markets do you serve?')
    ).toBe(true);
    expect(isWhatsAppAssistantInquiry('I need help with payment')).toBe(true);
    expect(
      isWhatsAppAssistantInquiry('Comment fonctionne le retrait?')
    ).toBe(true);
    expect(isWhatsAppAssistantInquiry('delivery fee')).toBe(true);
  });

  it('skips empty text', () => {
    expect(isWhatsAppAssistantInquiry('')).toBe(false);
    expect(isWhatsAppAssistantInquiry('   ')).toBe(false);
  });
});
