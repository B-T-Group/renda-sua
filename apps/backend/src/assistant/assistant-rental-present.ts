import type { RentalSearchHit } from '../rentals/rental-search.service';
import {
  clampExclusiveRange,
  latestExclusiveEndDate,
  type CardWindowFields,
  type CardWindowOffer,
} from '../rentals/rental-card-window';
import type { PublicRentalListingRow } from '../rentals/rentals.service';
import type {
  AssistantCard,
  AssistantChip,
  AssistantLocale,
  AssistantRentalAvailability,
  AssistantRentalCardDetails,
  AssistantRentalCta,
  AssistantRentalMeta,
} from './assistant.types';
import { cardWindowCutoffOnly, cardWindowUnfitReply, formatCardCutoff } from './assistant-rental-card-copy';
import { rentalArea } from './assistant-rental-questions';
import { addCalendarDays, exclusiveDayCount, marketCalendarDate } from './assistant-rental-dates';
import { perDayPriceLabel } from './assistant-rental-format';

const CARD_CAP = 6;

export type RentalPresentInput = {
  hits: RentalSearchHit[];
  total: number;
  locale: AssistantLocale;
  query: string;
  units: number;
  signedIn: boolean;
  ownListingIds: string[];
  allowSelfBooking: boolean;
  startDate?: string;
  endDate?: string;
  dayCount?: number;
  status: NonNullable<AssistantRentalMeta['status']>;
  dateIssue?: AssistantRentalMeta['dateIssue'];
  suggestion?: { startDate: string; endDate: string; dayCount: number };
  placeNote?: string;
  categories?: Array<{ id: string; name: string }>;
  buyItems?: Array<{ id: string; title: string; priceLabel: string; imageUrl?: string | null; href: string }>;
  cardWindow?: CardWindowFields & {
    fits?: boolean;
    asked?: { startDate: string; endDate: string };
    offered?: CardWindowOffer | null;
    guard?: boolean;
  };
};

export function presentRentalSearch(input: RentalPresentInput): {
  content: string;
  cards: AssistantCard[];
  rental: AssistantRentalMeta;
} {
  if (input.status === 'buy_or_rent') return buyOrRent(input);
  if (input.status === 'unavailable_error') return failed(input);
  if (input.status === 'invalid_dates' && input.dateIssue !== 'too_long') return invalid(input);
  return found(input);
}

export function presentRentalDetails(input: {
  listing: PublicRentalListingRow;
  locale: AssistantLocale;
  signedIn: boolean;
  own: boolean;
  allowSelfBooking: boolean;
  ref: string;
  window?: CardWindowFields;
}): { content: string; cards: AssistantCard[]; rental: AssistantRentalMeta } {
  const card = cardFromListing(input.listing, {
    locale: input.locale,
    units: 1,
    signedIn: input.signedIn,
    own: input.own,
    allowSelf: input.allowSelfBooking,
    availability: 'no_dates',
  });
  return {
    content: JSON.stringify({ ref: input.ref, listing: { ...listingFacts(input.listing), ...input.window } }),
    cards: [card],
    rental: { status: 'ok', refs: { [input.ref]: input.listing.id }, ...input.window },
  };
}

function found(input: RentalPresentInput) {
  const refs: Record<string, string> = {};
  const cards = input.hits.slice(0, CARD_CAP).map((hit, index) => {
    const ref = `r${index + 1}`;
    refs[ref] = hit.listing.id;
    return cardFromHit(hit, input, ref);
  });
  const dated = Boolean(input.startDate && input.endDate);
  const buyCards = cards.length ? [] : buyCardsFrom(input);
  const chips = followChips(input, cards);
  return {
    content: JSON.stringify(modelPayload(input, refs)),
    cards: cards.length ? cards : buyCards,
    rental: {
      status: input.dateIssue === 'too_long' ? 'invalid_dates' : input.status,
      dateIssue: input.dateIssue,
      dates: dated
        ? { startDate: input.startDate!, endDate: input.endDate!, dayCount: input.dayCount || 0 }
        : undefined,
      chips: chips.length ? chips : undefined,
      footnote: dated && cards.some((card) => card.rental?.quoteTotal != null) ? 'estimate' : undefined,
      showAllHref: input.total > 0 ? showAll(input) : undefined,
      showAllCount: input.total > 0 ? input.total : undefined,
      refs,
      ...windowFields(input),
    },
  };
}

function invalid(input: RentalPresentInput) {
  const chips = input.suggestion ? [rangeChip(input.locale, input.suggestion)] : undefined;
  return {
    content: JSON.stringify({
      status: 'invalid_dates',
      date_issue: input.dateIssue,
      suggestion: input.suggestion ?? null,
    }),
    cards: [],
    rental: { status: 'invalid_dates' as const, dateIssue: input.dateIssue, chips },
  };
}

function failed(input: RentalPresentInput) {
  return {
    content: JSON.stringify({ status: 'unavailable_error' }),
    cards: [],
    rental: {
      status: 'unavailable_error' as const,
        chips: [{ id: 'retry', label: input.locale === 'fr' ? 'Réessayer' : 'Try again', action: 'retry' as const, message: input.query }],
    },
  };
}

function buyOrRent(input: RentalPresentInput) {
  return {
    content: JSON.stringify({ status: 'buy_or_rent', query: input.query }),
    cards: [],
    rental: {
      status: 'buy_or_rent' as const,
      chips: [
        { id: 'rent', label: input.locale === 'fr' ? 'Louer' : 'Rent it', action: 'rent' as const, query: input.query },
        { id: 'buy', label: input.locale === 'fr' ? "L'acheter" : 'Buy it', action: 'buy' as const, query: input.query },
      ],
    },
  };
}

function modelPayload(input: RentalPresentInput, refs: Record<string, string>) {
  return {
    status: input.dateIssue === 'too_long' ? 'invalid_dates' : input.status,
    date_issue: input.dateIssue ?? null,
    checked: input.suggestion ?? null,
    place_note: input.placeNote ?? null,
    card_window: input.cardWindow
      ? {
          fits: input.cardWindow.fits !== false,
          asked: input.cardWindow.asked ?? null,
          offered: input.cardWindow.offered ?? null,
          say: cardWindowSay(input),
          ...windowFields(input),
        }
      : null,
    counts: { shown: Math.min(input.hits.length, CARD_CAP), total: input.total },
    rental_count: Math.min(input.hits.length, CARD_CAP),
    results: input.hits.slice(0, CARD_CAP).map((hit, index) => ({
      ref: `r${index + 1}`,
      name: hit.listing.rental_item.name,
      available: hit.available,
      next_free: hit.nextAvailableDate,
      day_count: hit.dayCount,
      quote_total: hit.available ? hit.totalForDates : null,
      per_day: hit.pricePerDay,
      currency: hit.listing.rental_item.currency,
    })),
    refs,
    related_categories: (input.categories || []).map((row) => row.name),
    buy_matches: (input.buyItems || []).length,
  };
}

function cardFromHit(hit: RentalSearchHit, input: RentalPresentInput, ref: string): AssistantCard {
  const own = input.ownListingIds.includes(hit.listing.id);
  const dates = datesForCard(hit, input);
  const availability = availabilityOf(hit, input, own);
  const card = cardFromListing(hit.listing, {
    locale: input.locale,
    units: input.units,
    signedIn: input.signedIn,
    own,
    allowSelf: input.allowSelfBooking,
    availability,
    startDate: dates.startDate,
    endDate: dates.endDate,
    dayCount: dates.dayCount,
    quoteTotal: hit.available ? hit.totalForDates ?? undefined : undefined,
    nextAvailableDate: hit.nextAvailableDate,
    cardEndDate: dates.cap,
  });
  card.id = ref;
  return card;
}

function availabilityOf(
  hit: RentalSearchHit,
  input: RentalPresentInput,
  own: boolean
): AssistantRentalAvailability {
  if (own && !input.allowSelfBooking) return 'own_listing';
  if (!input.startDate) return 'no_dates';
  if (input.dateIssue === 'too_long') return 'too_long';
  if (hit.available === false) return 'unavailable';
  if (hit.available && input.units > 1 && (hit.listing.units_available || 0) < input.units) {
    return 'partial_units';
  }
  return 'available';
}

function cardFromListing(
  listing: PublicRentalListingRow,
  extra: {
    locale: AssistantLocale;
    units: number;
    signedIn: boolean;
    own: boolean;
    allowSelf: boolean;
    availability: AssistantRentalAvailability;
    startDate?: string;
    endDate?: string;
    dayCount?: number;
    quoteTotal?: number;
    nextAvailableDate?: string | null;
    cardEndDate?: string;
  }
): AssistantCard {
  const currency = listing.rental_item.currency || 'XAF';
  const perDay = Number(listing.base_price_per_day) || 0;
  const deposit = Math.max(0, Number(listing.security_deposit_amount) || 0);
  const shift = shiftRange(extra.nextAvailableDate, extra.dayCount, extra.cardEndDate);
  const rental: AssistantRentalCardDetails = {
    listingId: listing.id,
    businessName: listing.rental_item.business?.name || listing.business_location?.name || '',
    city: listing.business_location?.address?.city || undefined,
    availability: extra.availability,
    startDate: extra.startDate,
    endDate: extra.endDate,
    dayCount: extra.dayCount,
    unitsRequested: extra.units,
    unitsFree: listing.units_available,
    quoteTotal: extra.availability === 'available' ? extra.quoteTotal : undefined,
    perDay,
    perHour: Number(listing.base_price_per_hour) || 0,
    deposit: deposit > 0 ? deposit : undefined,
    currency,
    nextAvailableDate: extra.nextAvailableDate,
    maxHours: listing.max_rental_hours,
    minHours: listing.min_rental_hours,
    canRequest: canRequest(extra),
    cta: ctaFor(extra, shift),
    shiftStart: shift?.startDate,
    shiftEnd: shift?.endDate,
  };
  return {
    kind: 'rental',
    id: listing.id,
    title: listing.rental_item.name,
    imageUrl: listing.rental_item.rental_item_images?.[0]?.display_url || listing.rental_item.rental_item_images?.[0]?.image_url || null,
    priceLabel: perDayPriceLabel(perDay, currency, extra.locale),
    href: listingHref(listing.id, extra.startDate, extra.endDate),
    rental,
  };
}

function canRequest(extra: { signedIn: boolean; own: boolean; allowSelf: boolean; availability: AssistantRentalAvailability }): boolean {
  if (extra.own && !extra.allowSelf) return false;
  return extra.availability === 'available' || extra.availability === 'no_dates' || extra.availability === 'partial_units';
}

function ctaFor(
  extra: { signedIn: boolean; availability: AssistantRentalAvailability },
  shift: { startDate: string; endDate: string } | null
): AssistantRentalCta {
  if (extra.availability === 'own_listing') return 'own';
  if (extra.availability === 'unavailable' && shift) return 'shift';
  if (!extra.signedIn && extra.availability === 'available') return 'sign_in';
  if (extra.availability === 'available' || extra.availability === 'no_dates') return 'request';
  return 'none';
}

function shiftRange(next: string | null | undefined, dayCount?: number, cap?: string) {
  if (!next || (cap && next >= cap)) return null;
  const days = dayCount && dayCount > 0 ? dayCount : 1;
  const end = cap && addCalendarDays(next, days) > cap ? cap : addCalendarDays(next, days);
  if (end <= next) return null;
  return { startDate: next, endDate: end };
}

function datesForCard(hit: RentalSearchHit, input: RentalPresentInput) {
  const start = input.startDate;
  const end = input.endDate;
  if (input.cardWindow?.guard === false) {
    return { startDate: start, endDate: end, dayCount: input.dayCount, cap: undefined as string | undefined };
  }
  const cap = cardCap(hit);
  if (!cap || !start || !end || end <= cap) {
    return { startDate: start, endDate: end, dayCount: input.dayCount, cap };
  }
  const offer = clampExclusiveRange({
    startDate: start,
    endDate: end,
    dayCount: input.dayCount || 1,
    latestCardEndAt: hit.latest_card_end_at || cap,
    zone: hit.timezone || 'Africa/Douala',
    today: marketCalendarDate(new Date(), hit.timezone || 'Africa/Douala'),
  }).offer;
  return { startDate: offer?.startDate, endDate: offer?.endDate, dayCount: offer?.dayCount, cap };
}

function cardCap(hit: RentalSearchHit): string | undefined {
  if (hit.payment_rail !== 'stripe' || !hit.latest_card_end_at || !hit.timezone) return undefined;
  return latestExclusiveEndDate(hit.latest_card_end_at, hit.timezone);
}

function cardWindowSay(input: RentalPresentInput): string | null {
  const window = input.cardWindow;
  if (!window || window.fits !== false || !window.latest_card_end_at) return null;
  const cutoff = formatCardCutoff(window.latest_card_end_at, window.timezone, input.locale);
  if (!window.offered) return cardWindowCutoffOnly(input.locale, cutoff);
  return cardWindowUnfitReply(input.locale, cutoff);
}

function windowFields(input: RentalPresentInput): Partial<CardWindowFields> {
  const window = input.cardWindow;
  if (!window) return {};
  return {
    mode: window.mode,
    latest_card_end_at: window.latest_card_end_at,
    payment_rail: window.payment_rail,
    momo_available: window.momo_available,
    stripe_review_hours: window.stripe_review_hours,
    timezone: window.timezone,
  };
}

function listingHref(id: string, start?: string, end?: string): string {
  if (!start || !end) return `/rentals/${id}`;
  return `/rentals/${id}?start_date=${start}&end_date=${end}&openRequest=1`;
}

function showAll(input: RentalPresentInput): string {
  const params = new URLSearchParams({ search: input.query });
  if (input.startDate && input.endDate) {
    params.set('start_date', input.startDate);
    params.set('end_date', input.endDate);
  }
  return `/rentals?${params.toString()}`;
}

function buyCardsFrom(input: RentalPresentInput): AssistantCard[] {
  return (input.buyItems || []).map((item) => ({
    kind: 'item' as const,
    id: item.id,
    title: item.title,
    imageUrl: item.imageUrl,
    priceLabel: item.priceLabel,
    href: item.href,
  }));
}

function followChips(input: RentalPresentInput, cards: AssistantCard[]): AssistantChip[] {
  if (!input.startDate || !input.endDate) return dateChips(input.locale);
  const rentalCards = cards.filter((card) => card.rental);
  const allBooked = rentalCards.length > 0 && rentalCards.every((card) => card.rental?.cta === 'shift');
  if (!allBooked) return categoryChips(input);
  const fr = input.locale === 'fr';
  return [{
    id: 'similar',
    label: fr ? 'Articles similaires' : 'Similar items',
    action: 'category',
    query: input.query,
    message: input.query,
  }];
}

function categoryChips(input: RentalPresentInput): AssistantChip[] {
  if (input.hits.length) return [];
  return (input.categories || []).slice(0, 3).map((row) => ({
    id: row.id,
    label: row.name,
    action: 'category' as const,
    query: row.name,
    message: row.name,
  }));
}

function dateChips(locale: AssistantLocale): AssistantChip[] {
  const fr = locale === 'fr';
  return [
    { id: 'today', label: fr ? "Aujourd'hui" : 'Today', action: 'dates', message: fr ? "Aujourd'hui" : 'Today' },
    { id: 'tomorrow', label: fr ? 'Demain' : 'Tomorrow', action: 'dates', message: fr ? 'Demain' : 'Tomorrow' },
    { id: 'weekend', label: fr ? 'Ce week-end' : 'This weekend', action: 'dates', message: fr ? 'Ce week-end' : 'This weekend' },
    { id: 'calendar', label: fr ? 'Choisir les dates' : 'Choose dates', action: 'calendar' },
  ];
}

function rangeChip(
  locale: AssistantLocale,
  range: { startDate: string; endDate: string; dayCount: number }
): AssistantChip {
  const days = exclusiveDayCount(range.startDate, range.endDate) ?? range.dayCount;
  const label = locale === 'fr' ? `${range.startDate} → ${range.endDate} · ${days} j` : `${range.startDate} → ${range.endDate} · ${days} days`;
  return {
    id: 'suggested-range',
    label,
    action: 'dates',
    startDate: range.startDate,
    endDate: range.endDate,
    message: label,
  };
}

function listingFacts(listing: PublicRentalListingRow) {
  return {
    name: listing.rental_item.name,
    business: listing.rental_item.business?.name || null,
    city: listing.business_location?.address?.city || null,
    deposit: emptyNumber(listing.security_deposit_amount),
    per_day: emptyNumber(listing.base_price_per_day),
    per_hour: emptyNumber(listing.base_price_per_hour),
    min_hours: listing.min_rental_hours ?? null,
    max_hours: listing.max_rental_hours ?? null,
    units: listing.units_available ?? null,
    area: rentalArea(listing),
    pickup: blankToNull(listing.pickup_instructions),
    dropoff: blankToNull(listing.dropoff_instructions),
    description: blankToNull(listing.rental_item.description),
  };
}

function blankToNull(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text ? text : null;
}

function emptyNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}
