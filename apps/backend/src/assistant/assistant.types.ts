export type AssistantChannel = 'whatsapp' | 'app';

export type AssistantLocale = 'en' | 'fr';

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantMarket = {
  country_code: string;
  state?: string;
};

export type AssistantIdentity = {
  isVerified: boolean;
  userId: string | null;
  firstName: string | null;
  preferredLanguage: AssistantLocale | null;
  /** Market resolved from context → primary address → phone */
  market: AssistantMarket | null;
  /** Deprecated: use market.country_code */
  country: string | null;
  phoneE164: string | null;
  accountType: string | null;
  /** Present when the user has a client profile (orders tools use this). */
  clientId: string | null;
};

export type AssistantChatInput = {
  channel: AssistantChannel;
  messages: AssistantChatMessage[];
  identity: AssistantIdentity;
  locale?: AssistantLocale | null;
  /** Market context from the client (optional) */
  marketContext?: AssistantMarket | null;
  /** Client-generated thread ID for analytics (optional) */
  threadId?: string;
};

export type AssistantReply = {
  reply: string;
  handoff: boolean;
  locale: AssistantLocale;
  /** When true, WhatsApp must not send a session message. */
  silent: boolean;
};

export type AssistantTurnInput = Omit<AssistantChatInput, 'locale'> & {
  localeHint?: AssistantLocale | null;
};

export type AssistantTurnResult = AssistantReply;

export type KnowledgeTopic =
  | 'company_locations'
  | 'markets'
  | 'payments'
  | 'delivery'
  | 'pickup'
  | 'support_contact'
  | 'reels';
