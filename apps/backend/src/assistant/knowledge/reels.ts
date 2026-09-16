import type { KnowledgeLocale } from './types';

const COPY: Record<KnowledgeLocale, string[]> = {
  en: [
    'Reels are short product videos from merchants on Rendasua.',
    'You can like, share, follow a store, or buy the linked product from a reel.',
    'Comments on reels may be enabled after the feed launches in your market.',
    'Merchants can upload a 15–30 second product video from their library, or spend one AI reel token to generate an 8 second product ad from a catalog photo.',
    'Each business gets one free AI reel token; extra tokens are paid (same price per token, packs of 1, 5, or 15).',
    'Library uploads do not require AI tokens and go through moderation before they appear in the feed.',
    'AI-generated product ads are prepared for the feed and then published automatically; shoppers can see them once processing finishes.',
    'Merchants must own or license any music in uploaded videos; AI-generated ads include generated audio.',
    'Report inappropriate reels from the flag icon; repeated reports can hide content.',
  ],
  fr: [
    'Les reels sont de courtes vidéos produits publiées par les marchands sur Rendasua.',
    'Vous pouvez aimer, partager, suivre une boutique ou acheter le produit lié depuis un reel.',
    'Les commentaires peuvent être activés quelques semaines après le lancement du fil dans votre marché.',
    'Les marchands peuvent importer une vidéo produit de 15–30 secondes depuis leur bibliothèque, ou utiliser un jeton reel IA pour générer une pub produit de 8 secondes à partir d’une photo du catalogue.',
    'Chaque commerce reçoit un jeton reel IA gratuit ; les jetons supplémentaires sont payants (même prix par jeton, packs de 1, 5 ou 15).',
    'Les imports depuis la bibliothèque ne nécessitent pas de jetons IA et passent par la modération avant d’apparaître dans le fil.',
    'Les pubs produit générées par IA sont préparées pour le fil puis publiées automatiquement ; les clients peuvent les voir dès que le traitement est terminé.',
    'Les marchands doivent détenir ou licencier toute musique dans les vidéos importées ; les pubs générées par IA incluent un audio généré.',
    'Signalez un reel inapproprié via l’icône signalement ; des signalements répétés peuvent masquer le contenu.',
  ],
};

export function getReelsKnowledge(locale: KnowledgeLocale): string {
  return COPY[locale].join('\n');
}
