import type { KnowledgeLocale } from './types';

const COPY: Record<KnowledgeLocale, string[]> = {
  en: [
    'Reels are short product videos from merchants on Rendasua.',
    'You can like, share, follow a store, or buy the linked product from a reel.',
    'Comments on reels may be enabled after the feed launches in your market.',
    'Merchants must own or license any music in their videos.',
    'Report inappropriate reels from the flag icon; repeated reports can hide content.',
  ],
  fr: [
    'Les reels sont de courtes vidéos produits publiées par les marchands sur Rendasua.',
    'Vous pouvez aimer, partager, suivre une boutique ou acheter le produit lié depuis un reel.',
    'Les commentaires peuvent être activés quelques semaines après le lancement du fil dans votre marché.',
    'Les marchands doivent détenir ou licencier toute musique utilisée dans leurs vidéos.',
    'Signalez un reel inapproprié via l’icône signalement ; des signalements répétés peuvent masquer le contenu.',
  ],
};

export function getReelsKnowledge(locale: KnowledgeLocale): string {
  return COPY[locale].join('\n');
}
