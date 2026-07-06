import { normalizeLanguage } from './email-template-data';
import type { RatingType } from '../ratings/dto/create-rating.dto';

export function buildRatingReceivedPushMessage(params: {
  ratingType: RatingType;
  rating: number;
  orderNumber: string;
  raterName?: string | null;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const stars = String(params.rating);
  const orderRef = params.orderNumber;
  const rater =
    params.raterName?.trim() ||
    (locale === 'fr' ? 'Quelqu’un' : 'Someone');

  if (locale === 'fr') {
    switch (params.ratingType) {
      case 'client_to_agent':
        return {
          title: 'Nouvelle évaluation',
          body: `${rater} vous a attribué ${stars}/5 pour la commande ${orderRef}`,
        };
      case 'agent_to_client':
        return {
          title: 'Nouvelle évaluation',
          body: `Votre livreur vous a attribué ${stars}/5 pour la commande ${orderRef}`,
        };
      case 'client_to_item':
        return {
          title: 'Nouvelle évaluation d’article',
          body: `Un client a attribué ${stars}/5 à un article (commande ${orderRef})`,
        };
      default:
        return {
          title: 'Nouvelle évaluation',
          body: `Vous avez reçu une évaluation de ${stars}/5`,
        };
    }
  }

  switch (params.ratingType) {
    case 'client_to_agent':
      return {
        title: 'New rating',
        body: `${rater} rated you ${stars}/5 on order ${orderRef}`,
      };
    case 'agent_to_client':
      return {
        title: 'New rating',
        body: `Your delivery agent rated you ${stars}/5 on order ${orderRef}`,
      };
    case 'client_to_item':
      return {
        title: 'New item rating',
        body: `A customer rated an item ${stars}/5 (order ${orderRef})`,
      };
    default:
      return {
        title: 'New rating',
        body: `You received a ${stars}/5 rating`,
      };
  }
}
