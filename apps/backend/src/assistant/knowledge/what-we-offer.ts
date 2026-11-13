import type { KnowledgeLocale } from './types';

const EN = `Rendasua is a super app that brings three personas together: a client, an agent, and a business. We help people find the products they need and help stores reach those people.

What each persona does:
- Clients shop, rent, order food, pay, and follow the order until it arrives or they pick it up.
- Businesses get an online presence for the goods they sell, the things they rent out, and the meals they cook.
- Independent agents earn by delivering orders and by bringing new stores onto Rendasua.

How it works:
- Stores list products so people can buy them online.
- People can rent what they own, and businesses can publish rental listings. When a rental has a condition report, the renter accepts that report and pays if payment is due at pickup, and the rental starts. Older rentals without a condition report still use a start PIN. For 30 minutes after an inspected rental starts, the renter can report that they have not received the item. Support and the business are told. Nothing is cancelled or refunded automatically. Telling the business that the item is back does not end the rental or release the deposit. The business still confirms the return. A rental price in the assistant is an estimate. The business confirms the price when it accepts, and nothing is charged until the renter confirms. A card rental authorized up front must end early enough that a 72-hour review still fits inside the 6-day card authorization. A card rental charged at pickup, and a mobile money rental, do not have that limit.
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
- On peut louer ce que l'on possède, et les commerces peuvent publier des annonces de location. Quand une location a un état des lieux, le locataire accepte ce constat et paie si le paiement est dû au retrait, puis la location démarre. Les locations plus anciennes, sans état des lieux, utilisent encore un code PIN de départ. Pendant 30 minutes après le démarrage d'une location avec état des lieux, le locataire peut signaler qu'il n'a pas reçu l'article. Le support et le commerce sont prévenus. Rien n'est annulé ni remboursé automatiquement. Dire à l'entreprise que l'article est de retour ne met pas fin à la location et ne libère pas la caution. L'entreprise confirme encore le retour. Un prix de location dans l'assistant est une estimation. L'entreprise confirme le prix quand elle accepte, et rien n'est débité tant que le locataire n'a pas confirmé. Une location par carte autorisée à l'avance doit se terminer assez tôt pour qu'un examen de 72 heures tienne dans l'autorisation de carte de 6 jours. Une location par carte débitée au retrait, et une location en mobile money, n'ont pas cette limite.
- Les restaurants peuvent saisir leur menu pour que les gens commandent en ligne, paient en ligne et évitent la file. On peut manger sur place ou emporter.
- Les commerces peuvent publier de courts reels pour que les clients voient un produit avant de l'acheter.
- L'IA aide les commerces à préparer leur catalogue. Renda est l'assistant dans l'application et sur WhatsApp, là pour vous accompagner.

Le paiement et la remise font partie de la commande. Selon le magasin et le pays, un client peut payer maintenant, à la livraison ou au retrait. Le mobile money et la carte n'existent que là où ce moyen est configuré. La remise se fait par livraison, retrait en magasin, ou sur place pour la nourriture.

Les crédits magasin s'appliquent au sous-total des articles. Ce n'est pas de l'argent retirable. La couverture des pays et les moyens de paiement viennent des outils pays et paiement, pas de ce résumé.`;

export function getWhatWeOfferKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
