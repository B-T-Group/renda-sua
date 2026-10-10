import type { KnowledgeLocale } from './types';

const EN = `Rendasua is a super app that brings three personas together: a client, an agent, and a business. We help people find the products they need and help stores reach those people.

What each persona does:
- Clients shop, rent, order food, pay, and follow the order until it arrives or they pick it up.
- Businesses get an online presence for the goods they sell, the things they rent out, and the meals they cook.
- Independent agents earn by delivering orders and by bringing new stores onto Rendasua.

How it works:
- Stores list products so people can buy them online.
- People can rent what they own, and businesses can publish rental listings.
- Restaurants can enter a menu so people order online, pay online, and skip the queue. Food can be eaten at the restaurant or taken away.
- Businesses can publish short reels so clients see a product before they buy.
- AI helps businesses prepare catalog content. Renda is the assistant in the app and on WhatsApp, here to help along the way.

Payments and fulfilment are part of the order. Depending on the store and the country, a client can pay now, pay at delivery, or pay at pickup. Mobile money and card payments are available only where that rail is configured. Fulfilment is delivery, store pickup, or eat-in for food.

Store credits apply to item subtotals. They are not cash and cannot be withdrawn. Live country coverage and payment rails come from the country and payment tools, not from this summary.`;

const FR = `Rendasua est une super-app qui réunit trois profils : le client, l'agent et le commerce. Nous aidons les gens à trouver les produits dont ils ont besoin et les magasins à les rejoindre.

Ce que fait chaque profil :
- Les clients achètent, louent, commandent à manger, paient et suivent la commande jusqu'à la livraison ou le retrait.
- Les commerces ont une présence en ligne pour ce qu'ils vendent, ce qu'ils louent et les repas qu'ils préparent.
- Les agents indépendants gagnent de l'argent en livrant des commandes et en faisant entrer de nouveaux magasins sur Rendasua.

Comment ça marche :
- Les magasins publient leurs produits pour que les gens puissent acheter en ligne.
- On peut louer ce que l'on possède, et les commerces peuvent publier des annonces de location.
- Les restaurants peuvent saisir leur menu pour que les gens commandent en ligne, paient en ligne et évitent la file. On peut manger sur place ou emporter.
- Les commerces peuvent publier de courts reels pour que les clients voient un produit avant de l'acheter.
- L'IA aide les commerces à préparer leur catalogue. Renda est l'assistant dans l'application et sur WhatsApp, là pour vous accompagner.

Le paiement et la remise font partie de la commande. Selon le magasin et le pays, un client peut payer maintenant, à la livraison ou au retrait. Le mobile money et la carte n'existent que là où ce moyen est configuré. La remise se fait par livraison, retrait en magasin, ou sur place pour la nourriture.

Les crédits magasin s'appliquent au sous-total des articles. Ce n'est pas de l'argent retirable. La couverture des pays et les moyens de paiement viennent des outils pays et paiement, pas de ce résumé.`;

export function getWhatWeOfferKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
