export type KnowledgeLocale = 'en' | 'fr';

import type { KnowledgeTopic } from '../assistant.types';

export type { KnowledgeTopic } from '../assistant.types';

export const KNOWLEDGE_TOPICS: readonly KnowledgeTopic[] = [
  'company_locations',
  'markets',
  'payments',
  'delivery',
  'pickup',
  'support_contact',
  'reels',
  'what_we_offer',
] as const;
