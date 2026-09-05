import { sanitizeAssistantReply } from './sanitize-assistant-reply';

describe('sanitizeAssistantReply', () => {
  it('removes thinking blocks and keeps the customer reply', () => {
    const input = `<thinking>Samuel is likely in Gabon.</thinking>
Bonjour Samuel, nous acceptons le paiement à la livraison au Gabon.`;
    expect(sanitizeAssistantReply(input)).toBe(
      'Bonjour Samuel, nous acceptons le paiement à la livraison au Gabon.'
    );
  });

  it('strips orphan thinking tags', () => {
    expect(
      sanitizeAssistantReply('<thinking>partial\nHello there')
    ).toBe('partial\nHello there');
  });

  it('removes reasoning blocks case-insensitively', () => {
    expect(
      sanitizeAssistantReply('<Reasoning>secret</Reasoning>\nVisible answer')
    ).toBe('Visible answer');
  });
});
