# Services et fonctionnalités – Côté Agent (aligné web)

## 1. Commandes disponibles (Open Orders)

| Service / Action | Méthode | Endpoint | Description |
|-----------------|---------|----------|-------------|
| Liste des commandes à réclamer | GET | `/orders/open` | Commandes prêtes pour ramassage, non assignées. Région déduite de l'adresse profil ou du GPS (géolocalisation). |
| Réclamer une commande | POST | `/orders/claim_order` | Body: `{ orderId }`. Réclame sans paiement caution. |
| Réclamer avec topup (mobile money) | POST | `/orders/claim_order_with_topup` | Body: `{ orderId, phone_number? }`. Réclame avec caution. |
| Abandonner une commande réclamée | POST | `/orders/drop_order` | Body: `{ orderId }`. |

---

## 2. Mes commandes (Agent Orders)

| Service / Action | Méthode | Endpoint | Description |
|-----------------|---------|----------|-------------|
| Liste de mes commandes | GET | `/orders` | Filtres côté backend (agent = utilisateur connecté). Retourne active, completed, cancelled. |
| Détail d’une commande | GET | `/orders/:orderId` | Détail complet (client, business, adresses, items, statuts). |
| Gains agent pour une commande | GET | `/orders/:orderId/agent-earnings` | Montants (total, base, per km, currency). |

### Actions sur une commande assignée

| Action | Méthode | Endpoint | Body |
|--------|---------|----------|------|
| Marquer « Récupérée » | POST | `/orders/pick_up` | `{ orderId, notes? }` |
| Marquer « En transit » | POST | `/orders/start_transit` | `{ orderId, notes? }` |
| Marquer « En livraison » | POST | `/orders/out_for_delivery` | `{ orderId, notes? }` |
| Marquer « Livrée » | POST | `/orders/deliver` | `{ orderId, notes? }` |
| Marquer « Échec livraison » | POST | `/failed-deliveries/fail` | `{ orderId, notes?, failure_reason_id }` |

| Service | Méthode | Endpoint | Description |
|---------|---------|----------|-------------|
| Raisons d’échec (liste) | GET | `/failed-deliveries/reasons` | Query: `?language=fr`. Pour le select « échec livraison ». |

---

## 3. Gains (Earnings)

| Service / Action | Méthode | Endpoint | Description |
|-----------------|---------|----------|-------------|
| Résumé des gains | GET | `/agents/earnings-summary` | todayEarnings, currency, todayDeliveryCount, activeOrderCount, recentCommissions[]. |
| Pourcentage de retenue | GET | `/agents/hold-percentage` | Pour afficher la règle de caution (non vérifié / vérifié / interne). |

---

## 4. Profil & Adresses

| Service / Action | Méthode | Endpoint | Description |
|-----------------|---------|----------|-------------|
| Liste des adresses | GET | `/addresses` | Adresses agent (optionnelles ; `/orders/open` utilise le GPS si absentes). |
| Créer une adresse | POST | `/addresses` | Body: address_line_1, city, state, postal_code, country, address_type, is_primary, etc. |
| Modifier une adresse | PUT | `/addresses/:addressId` | Mise à jour partielle. |
| Supprimer une adresse | DELETE | `/addresses/:addressId` | Suppression. |

---

## 5. Onboarding agent

| Service / Action | Méthode | Endpoint | Description |
|-----------------|---------|----------|-------------|
| Marquer onboarding complété | POST | `/agents/complete_onboarding` | Après le guide livraison. |

---

## 6. Messages commande (optionnel)

| Service / Action | Méthode | Endpoint | Description |
|-----------------|---------|----------|-------------|
| Liste des messages | GET | `/orders/:orderId/messages` | Messages de la commande. |
| Envoyer un message | POST | `/orders/:orderId/messages` | Body: contenu du message. |

---

## Menus drawer mobile (équivalent web)

| Menu | Équivalent web | Fonctionnalités / écrans |
|------|----------------|---------------------------|
| **Accueil** | Dashboard agent | Résumé gains (earnings-summary), quick stats, lien vers commandes disponibles. |
| **Commandes disponibles** | /open-orders | Liste GET /orders/open, réclamer (claim_order ou claim_order_with_topup). |
| **Mes commandes** | /orders | Liste GET /orders, onglets ou filtre actives/terminées/annulées, détail GET /orders/:id, actions: pick_up, start_transit, out_for_delivery, deliver, fail, drop. |
| **Gains** | Widget + page gains | GET /agents/earnings-summary, affichage today + recent commissions. |
| **Profil** | /profile | Infos utilisateur, adresses (GET/POST/PUT/DELETE /addresses), déconnexion. |

---

## Récap endpoints par préfixe

- **/orders** : open, claim_order, claim_order_with_topup, drop_order, pick_up, start_transit, out_for_delivery, deliver, :orderId, :orderId/agent-earnings, :orderId/messages
- **/agents** : earnings-summary, hold-percentage, complete_onboarding
- **/failed-deliveries** : fail, reasons
- **/addresses** : CRUD

Tous les appels sont authentifiés avec `Authorization: Bearer <access_token>` (API NestJS sous /api).

---

## Checklist implémentation mobile (agent-mobile)

| Service / Écran | Implémenté | Détail |
|-----------------|------------|--------|
| **Accueil** | ✅ | earnings-summary, hold-percentage, lien OpenOrders, bouton Réessayer |
| **Commandes disponibles** | ✅ | GET open, claim, claim_with_topup (modal téléphone iOS/Android), refresh |
| **Mes commandes** | ✅ | GET /orders, liste, navigation détail |
| **Détail commande** | ✅ | GET /orders/:id, agent-earnings, pick_up, start_transit, out_for_delivery, deliver, fail (reasons), drop |
| **Gains** | ✅ | earnings-summary, commissions récentes, refresh |
| **Profil** | ✅ | GET/DELETE adresses, POST adresse (modal formulaire), logout |
| **Hold percentage** | ✅ | Hook useHoldPercentage, affiché sur Accueil si > 0 |
| **Onboarding** | ⚪ | complete_onboarding présent dans agentApi, pas d’UI dédiée (optionnel) |
| **Messages commande** | ⚪ | Optionnel, non implémenté dans l’app |
