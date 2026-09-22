import type { KnowledgeLocale } from './types';

const EN = `Customer support contacts:

- Phone / WhatsApp: +1 855-648-8855
- Email: support@rendasua.com or info@rendasua.com

From a completed order in the app, you can reorder: we rebuild your cart with current prices and stock, and skip unavailable items. You still confirm checkout yourself — there is no one-tap pay.

If you cannot resolve the question from tools/knowledge, tell the user we will get back to them shortly and escalate to a human. For technical problems (app errors, payment failures, bugs), tell the user we are reaching out to the technical team to look into it.`;

const FR = `Contacts support client :

- Téléphone / WhatsApp : +1 855-648-8855
- E-mail : support@rendasua.com ou info@rendasua.com

Depuis une commande terminée dans l’app, vous pouvez commander à nouveau : nous reconstruisons votre panier avec les prix et stocks actuels, et laissons de côté les articles indisponibles. Vous confirmez toujours le paiement vous-même — il n’y a pas de paiement en un clic.

Si vous ne pouvez pas répondre avec les outils/connaissances, dites à l'utilisateur que nous reviendrons vers lui sous peu et transférez à un humain. Pour un problème technique (erreur d'app, échec de paiement, bug), indiquez que nous contactons l'équipe technique pour examiner la situation.`;

export function getSupportKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
