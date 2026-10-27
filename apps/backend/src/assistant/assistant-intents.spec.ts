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

  it('tells sellers customers can order before the payout number is confirmed', () => {
    const en = getKnowledgeSection({ topic: 'seller_faq', locale: 'en' });
    const fr = getKnowledgeSection({ topic: 'seller_faq', locale: 'fr' });
    expect(en).toMatch(/Customers can order before that number is confirmed/);
    expect(en).toMatch(/before you can accept the order/);
    expect(fr).toMatch(
      /Les clients peuvent commander avant que ce numéro soit confirmé/
    );
    expect(fr).toMatch(/avant d'accepter la commande/);
  });

  it('tells sellers free tokens cannot be gifted and late codes last 30 days', () => {
    const en = getKnowledgeSection({ topic: 'seller_faq', locale: 'en' });
    const fr = getKnowledgeSection({ topic: 'seller_faq', locale: 'fr' });
    expect(en).toMatch(/20 free image AI tokens/);
    expect(en).toMatch(/those free tokens cannot be gifted/);
    expect(en).toMatch(/within 30 days of signup/);
    expect(fr).toMatch(/20 jetons IA image gratuits/);
    expect(fr).toMatch(/ces jetons gratuits ne peuvent pas être offerts/);
    expect(fr).toMatch(/dans les 30 jours suivant l'inscription/);
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

  it('keeps RDC export-only and distinct from Congo-Brazzaville', () => {
    const en = getKnowledgeSection({ topic: 'markets', locale: 'en' });
    const fr = getKnowledgeSection({ topic: 'markets', locale: 'fr' });
    expect(en).toMatch(/Democratic Republic of the Congo \(RDC, CD\)/);
    expect(en).toMatch(/export interest only/);
    expect(en).toMatch(/Local shopping, delivery, pickup, and local payment are not available/);
    expect(en).toMatch(/not the Republic of the Congo \(Congo-Brazzaville, CG\)/);
    expect(fr).toMatch(/République démocratique du Congo \(RDC, CD\)/);
    expect(fr).toMatch(/uniquement pour cet intérêt à l'export/);
    expect(fr).toMatch(/n'est pas la République du Congo \(Congo-Brazzaville, CG\)/);
    expect(fr).not.toEqual(en);
  });

  it('tells CD shoppers there is no local payment, and does not say that for CG', () => {
    const en = getKnowledgeSection({ topic: 'payments', locale: 'en', country: 'CD' });
    const fr = getKnowledgeSection({ topic: 'payments', locale: 'fr', country: 'cd' });
    const cg = getKnowledgeSection({ topic: 'payments', locale: 'en', country: 'CG' });
    expect(en).toMatch(/no local payment/);
    expect(en).toMatch(/not Congo-Brazzaville/);
    expect(en).not.toMatch(/MTN Mobile Money and Orange Money/);
    expect(fr).toMatch(/pas de paiement local/);
    expect(fr).toMatch(/Ce n'est pas le Congo-Brazzaville/);
    expect(fr).not.toEqual(en);
    expect(cg).not.toMatch(/no local payment/);
    expect(cg).not.toMatch(/Democratic Republic of the Congo/);
  });

  it('says delivery is not available in the DRC', () => {
    const en = getKnowledgeSection({ topic: 'delivery', locale: 'en' });
    const fr = getKnowledgeSection({ topic: 'delivery', locale: 'fr' });
    expect(en).toMatch(
      /Delivery is not available in the Democratic Republic of the Congo \(RDC, CD\)/
    );
    expect(en).toMatch(/export interest only/);
    expect(fr).toMatch(
      /La livraison n'est pas disponible en République démocratique du Congo \(RDC, CD\)/
    );
    expect(fr).toMatch(/intérêt à l'export/);
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