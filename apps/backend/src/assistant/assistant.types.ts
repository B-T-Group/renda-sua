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
  lastName?: string | null;
  email?: string | null;
  preferredLanguage: AssistantLocale | null;
  /** Market resolved from context → primary address → phone */
  market: AssistantMarket | null;
  /** Deprecated: use market.country_code */
  country: string | null;
  phoneE164: string | null;
  /** Active persona when that profile exists; otherwise the enrolled fallback. */
  accountType: string | null;
  clientId: string | null;
  agentId?: string | null;
  businessId?: string | null;
};

export type AssistantCardKind = 'item' | 'order' | 'rental' | 'store' | 'sign_in';

export type AssistantCard = {
  kind: AssistantCardKind;
  id: string;
  title?: string;
  imageUrl?: string | null;
  priceLabel?: string;
  href?: string;
  /** Completed client orders only. */
  secondaryHref?: string;
};

export type AssistantToolResult = {
  content: string;
  handoff?: boolean;
  cards?: AssistantCard[];
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
  /** Set when the HTTP client disconnects so the tool loop can stop. */
  signal?: AbortSignal;
};

export type AssistantReply = {
  reply: string;
  handoff: boolean;
  locale: AssistantLocale;
  /** When true, WhatsApp must not send a session message. */
  silent: boolean;
  /** In-app entity cards. Omitted on WhatsApp. */
  cards?: AssistantCard[];
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
  | 'reels'
  | 'what_we_offer';
