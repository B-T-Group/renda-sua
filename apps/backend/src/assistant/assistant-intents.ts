/** Guest questions that need an account. Public shopping questions do not match. */
export function guestAsksForPersonalData(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  if (PERSONAL_PHRASE.test(normalized)) return true;
  return POSSESSIVE.test(normalized) && PERSONAL_NOUN.test(normalized);
}

export function staticKnowledgeTopic(
  text: string
): 'what_we_offer' | 'support_contact' | null {
  if (OFFER.test(text)) return 'what_we_offer';
  if (CONTACT.test(text)) return 'support_contact';
  return null;
}

const PERSONAL_PHRASE =
  /\b(my orders|recent orders|my credits|credits do i have|my wallet|my addresses|my profile|my earnings|my deliveries|my store|my catalog|my bookings|mes commandes|commandes récentes|mes crédits|crédits ai-je|mon portefeuille|mes adresses|mon profil|mes gains|mes livraisons|ma boutique|mon catalogue|mes réservations)\b/i;

const POSSESSIVE = /\b(my|mes|mon|ma)\b/i;

const PERSONAL_NOUN =
  /\b(order|orders|commande|commandes|credit|credits|crédit|crédits|address|addresses|adresse|adresses|profile|profil|wallet|portefeuille|earning|earnings|gain|gains|deliveries|livraisons|boutique|catalog|catalogue|booking|bookings|réservation|réservations)\b/i;

const OFFER =
  /\b(what does rendasua offer|what do you offer|what is rendasua|what are you|que propose rendasua|qu['’]est-ce que rendasua|c['’]est quoi rendasua)\b/i;

const CONTACT =
  /\b(how can i contact|how can you contact|contact us|contact you|comment (vous )?contacter|nous contacter|phone number|numéro de téléphone|adresse e-mail)\b/i;
