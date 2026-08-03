---
name: feature-update
description: >-
  Rédige un message Slack en français pour l’équipe Rendasua à partir d’une
  liste de features fournie par l’utilisateur, enrichie avec le contexte git
  récent. À utiliser avec /feature-update, pour une mise à jour produit Slack,
  un changelog d’équipe en français, ou un résumé des nouveautés.
disable-model-invocation: true
---

# Mise à jour produit (Slack FR)

Rédige **toujours en français** un message Slack prêt à coller, qui résume les
avancées produit / tech. L’utilisateur liste les features à couvrir ; enrichis
chaque point avec le contexte réel des changements de code. Style : direct,
clair, encourageant pour l’équipe.

**Langue :** français uniquement. Ne passe en anglais que si l’utilisateur le
demande explicitement.

## Entrées

Depuis le message utilisateur (sinon demander une seule fois) :

1. **Features à couvrir** — puces, noms ou notes courtes (obligatoire).
2. **Périmètre optionnel** — fenêtre (`7 derniers jours`, `depuis vendredi`),
   branche, repos (`rendasua`, `mobile-rendasua`, les deux), ou tag/release.
3. **Ajustements de ton optionnels** — plus formel, mention d’une personne, etc.

Sans fenêtre de temps : **7–14 derniers jours** de commits sur la branche
courante vs `main` / merges récents.

## Déroulement

1. **Lire** la liste de features. N’invente pas de sujets hors liste, sauf un
   détail étroitement lié clairement livré sous une de leurs puces (une courte
   clause max).
2. **Collecter le contexte code** (les deux workspaces si pertinent) :
   - `/Users/besongsamuel/Documents/Github/rs/rendasua`
   - `/Users/besongsamuel/Workspace/mobile-rendasua`
   - `git log`, `git diff`, titres/descriptions de PR si utile.
   - Prioriser l’impact utilisateur / métier, pas les chemins de fichiers.
3. **Mapper** chaque feature → 1–2 résultats concrets.
4. **Rédiger** le message Slack **en français** avec le modèle ci-dessous.
5. **Sortie** : uniquement le texte Slack prêt à coller (+ une ligne de note si
   tu as fusionné ou corrigé quelque chose pour exactitude).

## Ton

- Direct — pas de blabla marketing.
- Encourageant — « on », « équipe », reconnaissance sans être mièvre.
- Exact — si le code contredit la note utilisateur, corrige gentiment dans le
  brouillon (toujours positif).
- Collectif — créditer l’équipe, pas « je » ; nommer quelqu’un seulement si
  demandé.
- Éviter le bruit interne (refactors, typings) sauf demande explicite.

## Modèle Slack (français)

Format Slack : gras avec `*texte*`, puces.

```text
🚀 *Mise à jour produit — [période courte]*

Salut l’équipe 👋
Voici ce qui a avancé récemment :

• *[Titre court feature]* — [1 phrase d’impact utilisateur / métier]
• *[Titre court feature]* — [1 phrase d’impact]
• *[Titre court feature]* — [1 phrase d’impact]

Merci pour le travail — on continue comme ça 💪
```

### Règles par puce

- Titre : langage produit court (pas un sujet de commit).
- Corps : une phrase, ~20 mots max, bénéfice concret.
- Deuxième phrase seulement si vraiment nécessaire (rare).
- Pas d’IDs de tickets, chemins de fichiers ni numéros de PR sauf demande.
- Idéal : 3–7 puces ; fusionner les petits items liés.

### Variantes

- Seulement **mobile** ou **web / backend** : le préciser dans l’en-tête.
- **Anglais** : uniquement sur demande explicite.
- Version **réponse de fil** : intro plus courte + puces seules.

## À éviter

- Coller un `git log` brut.
- Longs changelogs ou digressions techniques.
- Présenter comme livré ce qui ne l’est pas.
- Remplir avec des features non listées.

## Exemple

**Utilisateur :** `/feature-update`
- Paiement Stripe amélioré
- Notifications agent
- Fix inventaire mobile

**Sortie :**

```text
🚀 *Mise à jour produit — semaine dernière*

Salut l’équipe 👋
Voici ce qui a avancé récemment :

• *Paiements Stripe* — parcours plus fiable, moins d’échecs au checkout.
• *Notifications agent* — les agents sont alertés plus vite sur les nouvelles courses.
• *Inventaire mobile* — correction des écarts de stock affichés dans l’app.

Merci pour le travail — on continue comme ça 💪
```
