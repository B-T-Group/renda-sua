import { getCompanyKnowledge } from './company';
import { getDeliveryKnowledge } from './delivery';
import { getMarketsKnowledge } from './markets';
import { getPaymentsKnowledge } from './payments';
import { getPickupKnowledge } from './pickup';
import { getSupportKnowledge } from './support';
import { getReelsKnowledge } from './reels';
import { getWhatWeOfferKnowledge } from './what-we-offer';
import type { KnowledgeLocale, KnowledgeTopic } from './types';

export * from './types';

export function getKnowledgeSection(params: {
  topic: KnowledgeTopic;
  locale: KnowledgeLocale;
  country?: string | null;
}): string {
  switch (params.topic) {
    case 'company_locations':
      return getCompanyKnowledge(params.locale);
    case 'markets':
      return getMarketsKnowledge(params.locale);
    case 'payments':
      return getPaymentsKnowledge(params.locale, params.country);
    case 'delivery':
      return getDeliveryKnowledge(params.locale);
    case 'pickup':
      return getPickupKnowledge(params.locale);
    case 'support_contact':
      return getSupportKnowledge(params.locale);
    case 'reels':
      return getReelsKnowledge(params.locale);
    case 'what_we_offer':
      return getWhatWeOfferKnowledge(params.locale);
    default:
      return '';
  }
}
