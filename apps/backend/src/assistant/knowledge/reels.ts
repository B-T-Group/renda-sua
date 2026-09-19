import type { KnowledgeLocale } from './types';

const COPY: Record<KnowledgeLocale, string[]> = {
  en: [
    'Reels are short product videos from merchants on Rendasua.',
    'You can like, share, follow a store, or buy the linked product from a reel.',
    'Comments on reels may be enabled after the feed launches in your market.',
    'Merchants can upload a product video from their library (at least 15 seconds; clips longer than 30 seconds are trimmed to the first 30 seconds; max source length 2 minutes), or spend reel tokens to generate an 8 second product ad from a catalog photo.',
    'Each business gets one free AI reel token; extra tokens are paid (same price per token, packs of 1, 5, or 15). Standard AI generation costs 1 token; Premium costs 4.',
    'Library uploads do not require AI tokens and go through moderation before they appear in the feed.',
    'AI-generated product ads are prepared for the feed and then published automatically; shoppers can see them once processing finishes.',
    'Merchants must own or license any music in uploaded videos; AI-generated ads include generated audio.',
    'Report inappropriate reels from the flag icon; repeated reports can hide content.',
  ],
  fr: [
    'Les reels sont de courtes vidéos produits publiées par les marchands sur Rendasua.',
    'Vous pouvez aimer, partager, suivre une boutique ou acheter le produit lié depuis un reel.',
    'Les commentaires peuvent être activés quelques semaines après le lancement du fil dans votre marché.',
    'Les marchands peuvent importer une vidéo produit depuis leur bibliothèque (au moins 15 secondes ; au-delà de 30 secondes, découpage aux 30 premières secondes ; durée source max 2 minutes), ou utiliser des jetons reel IA pour générer une pub produit de 8 secondes à partir d’une photo du catalogue.',
    'Chaque commerce reçoit un jeton reel IA gratuit ; les jetons supplémentaires sont payants (même prix par jeton, packs de 1, 5 ou 15). La génération Standard coûte 1 jeton ; Premium en coûte 4.',
    'Les imports depuis la bibliothèque ne nécessitent pas de jetons IA et passent par la modération avant d’apparaître dans le fil.',
    'Les pubs produit générées par IA sont préparées pour le fil puis publiées automatiquement ; les clients peuvent les voir dès que le traitement est terminé.',
    'Les marchands doivent détenir ou licencier toute musique dans les vidéos importées ; les pubs générées par IA incluent un audio généré.',
    'Signalez un reel inapproprié via l’icône signalement ; des signalements répétés peuvent masquer le contenu.',
  ],
};

export function getReelsKnowledge(locale: KnowledgeLocale): string {
  return COPY[locale].join('\n');
}
