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

  it.each([
    'Quelle est votre commission ?',
    'How much do you take after the first 15 sales?',
    'How much do you charge?',
    'Je veux devenir un restaurant',
    'Je veux devenir marchand',
    "Comment m'inscrire ?",
    'Comment m’inscrire ?',
    'Y a-t-il des frais mensuels ?',
    'Comment se désabonner ?',
    "Qu'est-ce que je gagne ?",
    'Qu’est-ce que vous y gagnez ?',
    'Quel est votre pourcentage ?',
    'I want to join as a seller',
    'Can I sign up my restaurant?',
    'les 15 premieres ventes',
    'How can I contact you about your commission?',
  ])('routes seller question %s to seller_faq', (text) => {
    expect(staticKnowledgeTopic(text)).toBe('seller_faq');
  });

  it.each([
    ['What does Rendasua offer?', 'what_we_offer'],
    ['How can I contact you?', 'support_contact'],
    ['Do you support payment at delivery?', null],
    ['When is my order arriving?', null],
    ['', null],
  ] as const)('keeps %s off the seller faq', (text, topic) => {
    expect(staticKnowledgeTopic(text)).toBe(topic);
  });

  it('returns the seller faq money facts in English and French', () => {
    const en = getKnowledgeSection({ topic: 'seller_faq', locale: 'en' });
    const fr = getKnowledgeSection({ topic: 'seller_faq', locale: 'fr' });
    expect(en).toMatch(/no monthly fee/);
    expect(en).toMatch(/Cameroon and Gabon/);
    expect(en).toMatch(/0% item commission on the first 15 sales, then 7%/);
    expect(en).toMatch(/not taken out of the 7%/);
    expect(en).toMatch(/paid when the courier picks up the order/);
    expect(en).toMatch(/paid when the customer confirms collection/);
    expect(en).toMatch(/Mobile Money/);
    expect(fr).toMatch(/pas de frais mensuels/);
    expect(fr).toMatch(/Au Cameroun et au Gabon/);
    expect(fr).toMatch(/0 % de commission sur les 15 premières ventes, puis 7 %/);
    expect(fr).toMatch(/ne sont pas déduits des 7 %/);
    expect(fr).toMatch(/payé dès que le livreur récupère/);
    expect(fr).toMatch(/payé dès que le client confirme le retrait/);
    expect(fr).not.toEqual(en);
  });

  it('keeps the seller office address aligned in English and French', () => {
    const en = getKnowledgeSection({ topic: 'company_locations', locale: 'en' });
    const fr = getKnowledgeSection({ topic: 'company_locations', locale: 'fr' });
    expect(en).toMatch(/facing Caisse des Dépôts et Consignations, 2nd floor, Bastos/);
    expect(fr).toMatch(/face à la Caisse des Dépôts et Consignations, 2e étage, Bastos/);
    expect(en).toMatch(/Sellers are welcome at the Yaoundé and Douala offices/);
    expect(fr).toMatch(/bureaux de Yaoundé et de Douala/);
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