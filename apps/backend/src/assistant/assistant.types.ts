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

export type AssistantRentalAvailability =
  | 'available'
  | 'partial_units'
  | 'unavailable'
  | 'no_dates'
  | 'too_long'
  | 'too_short'
  | 'own_listing';

export type AssistantRentalCta = 'request' | 'sign_in' | 'shift' | 'own' | 'none';

/** Optional block on kind 'rental'. Older apps ignore it and still show title + price. */
export type AssistantRentalCardDetails = {
  listingId: string;
  businessName: string;
  city?: string;
  availability: AssistantRentalAvailability;
  startDate?: string;
  endDate?: string;
  dayCount?: number;
  startAt?: string;
  endAt?: string;
  hours?: number;
  unitsRequested: number;
  unitsFree?: number;
  quoteTotal?: number;
  perDay?: number;
  perHour?: number;
  deposit?: number;
  currency: string;
  nextAvailableDate?: string | null;
  maxHours?: number | null;
  minHours?: number;
  canRequest: boolean;
  cta: AssistantRentalCta;
  shiftStart?: string;
  shiftEnd?: string;
  cardNote?: string;
};

export type AssistantChipAction =
  | 'dates'
  | 'search'
  | 'buy'
  | 'rent'
  | 'retry'
  | 'calendar'
  | 'category';

export type AssistantChip = {
  id: string;
  label: string;
  message?: string;
  action?: AssistantChipAction;
  startDate?: string;
  endDate?: string;
  query?: string;
};

export type AssistantRentalDates =
  | { startDate: string; endDate: string; dayCount: number }
  | { startAt: string; endAt: string; hours: number };

export type AssistantRentalMeta = {
  status?: 'ok' | 'needs_dates' | 'invalid_dates' | 'unavailable_error' | 'buy_or_rent';
  dateIssue?: 'past' | 'end_before_start' | 'too_long' | 'unparseable' | 'card_window';
  mode?: 'authorize_upfront' | 'charge_at_pickup';
  latest_card_end_at?: string | null;
  payment_rail?: 'stripe' | 'mobile_money';
  momo_available?: boolean;
  stripe_review_hours?: number;
  timezone?: string;
  dates?: AssistantRentalDates;
  chips?: AssistantChip[];
  footnote?: string;
  showAllHref?: string;
  showAllCount?: number;
  refs?: Record<string, string>;
};

export type AssistantCard = {
  kind: AssistantCardKind;
  id: string;
  title?: string;
  imageUrl?: string | null;
  priceLabel?: string;
  href?: string;
  /** Completed client orders only. */
  secondaryHref?: string;
  rental?: AssistantRentalCardDetails;
};

export type AssistantToolResult = {
  content: string;
  handoff?: boolean;
  cards?: AssistantCard[];
  rental?: AssistantRentalMeta;
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
  /** Dates the client already confirmed (date chip or editor). */
  rentalDates?: {
    startDate?: string;
    endDate?: string;
    startAt?: string;
    endAt?: string;
  };
  /** Refs from the previous rental search (r1 → listing id). */
  rentalRefs?: Record<string, string>;
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
  /** Rental date chip, follow-up chips, and the estimate footnote. */
  rental?: AssistantRentalMeta;
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
  | 'what_we_offer'
  | 'seller_faq';
