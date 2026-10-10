import { getKnowledgeSection } from './knowledge';
import { guestAsksForPersonalData, staticKnowledgeTopic } from './assistant-intents';

describe('assistant intents', () => {
  it('treats account questions as personal and shopping questions as public', () => {
    expect(guestAsksForPersonalData('What are my recent orders?')).toBe(true);
    expect(guestAsksForPersonalData('Quels sont mes crédits ?')).toBe(true);
    expect(guestAsksForPersonalData('What can I buy or rent?')).toBe(false);
    expect(guestAsksForPersonalData('What does Rendasua offer?')).toBe(false);
    expect(guestAsksForPersonalData('How do store credits work?')).toBe(false);
    expect(guestAsksForPersonalData('What store credits do I have?')).toBe(true);
    expect(guestAsksForPersonalData('my store credits')).toBe(true);
  });

  it('does not treat a blank question or a public wallet explanation as personal', () => {
    expect(guestAsksForPersonalData('   ')).toBe(false);
    expect(guestAsksForPersonalData('How do wallets work?')).toBe(false);
    expect(guestAsksForPersonalData('my wallet')).toBe(true);
    expect(guestAsksForPersonalData('mes livraisons')).toBe(true);
  });

  it('routes offer and contact questions to static knowledge', () => {
    expect(staticKnowledgeTopic('What does Rendasua offer?')).toBe('what_we_offer');
    expect(staticKnowledgeTopic('How can I contact you?')).toBe('support_contact');
    expect(staticKnowledgeTopic('Do you support payment at delivery?')).toBeNull();
  });

  it('returns what we offer in English and French', () => {
    const en = getKnowledgeSection({ topic: 'what_we_offer', locale: 'en' });
    const fr = getKnowledgeSection({ topic: 'what_we_offer', locale: 'fr' });
    expect(en).toMatch(/super app/i);
    expect(en).toMatch(/client/i);
    expect(fr).toMatch(/super-app/i);
    expect(fr).not.toEqual(en);
  });
});