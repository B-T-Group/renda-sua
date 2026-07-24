export type AiProposalPushLocale = 'en' | 'fr';

function normalizeLocale(lang?: string | null): AiProposalPushLocale {
  return (lang || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function buildItemAiProposalPushMessage(params: {
  itemName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Suggestions IA prêtes' : 'AI suggestions ready',
    body: fr
      ? `Des améliorations ont été suggérées pour "${params.itemName}". Examinez et publiez votre article.`
      : `Improvements were suggested for "${params.itemName}". Review and publish your item.`,
  };
}

export function buildRentalListingAiProposalPushMessage(params: {
  rentalItemName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Suggestions IA prêtes' : 'AI suggestions ready',
    body: fr
      ? `Des améliorations ont été suggérées pour l'annonce "${params.rentalItemName}". Examinez et publiez.`
      : `Improvements were suggested for listing "${params.rentalItemName}". Review and publish.`,
  };
}
