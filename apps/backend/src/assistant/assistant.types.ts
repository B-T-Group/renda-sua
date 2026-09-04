export type AssistantChannel = 'whatsapp' | 'app';

export type AssistantLocale = 'en' | 'fr';

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantIdentity = {
  isVerified: boolean;
  userId: string | null;
  firstName: string | null;
  preferredLanguage: AssistantLocale | null;
  country: string | null;
  phoneE164: string | null;
  accountType: string | null;
};

export type AssistantChatInput = {
  channel: AssistantChannel;
  messages: AssistantChatMessage[];
  identity: AssistantIdentity;
  locale?: AssistantLocale | null;
};

export type AssistantReply = {
  reply: string;
  handoff: boolean;
  locale: AssistantLocale;
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
  | 'support_contact';
