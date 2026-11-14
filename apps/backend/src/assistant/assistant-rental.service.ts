import { Injectable, Logger } from '@nestjs/common';
import type { Tool } from '@aws-sdk/client-bedrock-runtime';
import { AppConfigService } from '../app-config/app-config.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { InventoryItemsService } from '../inventory-items/inventory-items.service';
import { marketTimeZone, marketsMissingTimeZone } from '../common/market-timezones';
import {
  clampExclusiveRange,
  latestExclusiveEndDate,
  listingCountryCode,
  readLatestCardEndAt,
  type CardWindowFields,
  type CardWindowOffer,
} from '../rentals/rental-card-window';
import { RentalInspectionFlags } from '../rentals/inspection/rental-inspection-flags.service';
import { unitsStillFree, type CapacityWindow } from '../rentals/rental-capacity';
import { RentalSearchService, type RentalSearchHit } from '../rentals/rental-search.service';
import { RentalsService, type PublicRentalListingRow } from '../rentals/rentals.service';
import { emitServerSiteEvent } from '../site-events/server-site-events.helper';
import { SiteEventsService } from '../site-events/site-events.service';
import type { AssistantChip, AssistantIdentity, AssistantLocale, AssistantToolResult } from './assistant.types';
import {
  marketCalendarDate,
  relativeDayRange,
  resolveMonthDay,
  validateExclusiveRange,
  type ResolvedRentalRange,
} from './assistant-rental-dates';
import { shouldAskBuyOrRent } from './assistant-rental-intent';
import { perDayPriceLabel } from './assistant-rental-format';
import {
  assistantDateChip,
  calendarChip,
  presentRentalDetails,
  presentRentalSearch,
} from './assistant-rental-present';
import { quoteDayTotal, quoteHourlyWindow } from './assistant-rental-quote';
import { rentalAnswerGrounded, rentalQuestionSay, rentalQuestionTopic } from './assistant-rental-questions';
import { rentalSearchTerms } from './assistant-rental-query';
import { buildZeroResultDraft, rentalDayBucket } from './assistant-rental-zero-results';

const SEARCH_MS = 4000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type AssistantRentalTurn = {
  userText: string;
  channel: 'app' | 'whatsapp';
  rentalDates?: { startDate?: string; endDate?: string; startAt?: string; endAt?: string };
  rentalRefs: Record<string, string>;
};

export type AssistantRentalCall = {
  name: string;
  input: Record<string, unknown>;
  identity: AssistantIdentity;
  locale?: AssistantLocale;
  turn?: AssistantRentalTurn;
};

@Injectable()
export class AssistantRentalService {
  private readonly logger = new Logger(AssistantRentalService.name);

  constructor(
    private readonly search: RentalSearchService,
    private readonly rentals: RentalsService,
    private readonly inspectionFlags: RentalInspectionFlags,
    private readonly appConfig: AppConfigService,
    private readonly inventory: InventoryItemsService,
    private readonly hasura: HasuraSystemService,
    private readonly siteEvents: SiteEventsService
  ) {}

  toolSpecs(): Tool[] {
    return [searchTool(), detailsTool(), quoteTool()];
  }

  handles(name: string): boolean {
    return name === 'search_rentals' || name === 'get_rental_listing_details' || name === 'quote_rental';
  }

  async enabled(countryCode?: string | null): Promise<boolean> {
    try {
      const flags = await this.appConfig.getClientFlags(countryCode || undefined);
      return flags.assistant_rentals_enabled === true;
    } catch (error: any) {
      this.logger.warn(`Rental assistant flag check failed: ${error?.message ?? error}`);
      return false;
    }
  }

  async run(call: AssistantRentalCall): Promise<AssistantToolResult> {
    if (call.name === 'get_rental_listing_details') return this.details(call);
    if (call.name === 'quote_rental') return this.quote(call);
    return this.searchRentals(call);
  }

  async readiness(): Promise<{ ok: boolean; missing: string[] }> {
    const codes = await this.activeMarketCodes();
    const missing = marketsMissingTimeZone(codes);
    return { ok: missing.length === 0, missing };
  }

  private async searchRentals(call: AssistantRentalCall): Promise<AssistantToolResult> {
    const started = Date.now();
    const locale = call.locale === 'fr' ? 'fr' : 'en';
    const country = marketCode(call.identity);
    const zone = marketTimeZone(country) ?? 'Africa/Douala';
    const query = text(call.input.query) || text(call.turn?.userText);
    const range = this.rangeFrom(call, zone);
    if (range?.status === 'invalid_dates' && range.dateIssue !== 'too_long') {
      return this.finish(call, presentRentalSearch(base(call, locale, query, [], 0, range)), started, false);
    }
    if (await this.askBuyOrRent(call, query, country)) {
      return this.finish(call, presentRentalSearch({ ...base(call, locale, query, [], 0), status: 'buy_or_rent' }), started, false);
    }
    const checked = range?.status === 'invalid_dates' ? range.suggestion : range?.status === 'ok' ? range : undefined;
    try {
      const dated = await this.cardDates(country, checked);
      const found = await this.matchingPage(query, country, dated.start, dated.end, call);
      const page = found.page;
      const placed = filterPlace(page.listings, text(call.input.place));
      const priced = filterPrice(placed.hits, numberOr(call.input.max_price_per_day));
      const card = await this.bookableSuggestion(dated, found.query, country, call);
      const quickChips = await this.quickDateChips(card, found.query, country, locale, call);
      const allow = await this.inspectionFlags.allowSelfBooking(country);
      const categories = found.categories;
      const buyItems = priced.length ? [] : await this.buyItems(query, country, locale);
      const presented = presentRentalSearch({
        ...base(call, locale, found.query, priced, placed.ignored ? page.total : priced.length),
        allowSelfBooking: allow,
        ownListingIds: priced
          .filter((hit) => hit.listing.rental_item.business?.id === call.identity.businessId)
          .map((hit) => hit.listing.id),
        status: card.start ? 'ok' : 'needs_dates',
        dateIssue: card.issue ?? (range?.status === 'invalid_dates' ? 'too_long' : undefined),
        suggestion: card.issue || range?.status !== 'invalid_dates' ? undefined : range.suggestion,
        startDate: card.start,
        endDate: card.end,
        dayCount: card.dayCount,
        cardWindow: {
          ...card.window,
          fits: !card.issue,
          asked: card.asked,
          offered: card.offer,
          guard: card.guard,
        },
        placeNote: placed.ignored ? 'place_ignored' : undefined,
        categories,
        buyItems,
        quickChips,
      });
      if (!priced.length) {
        await this.storeZero(query, country, card.dayCount ?? checked?.dayCount, call, buyItems.length, guessCategory(query, categories));
      }
      return this.finish(call, presented, started, !priced.length, {
        buyMatches: buyItems.length,
        categoryGuess: guessCategory(query, categories),
      });
    } catch (error: any) {
      this.logger.warn(`Rental search failed: ${error?.message ?? error}`);
      return this.finish(call, presentRentalSearch({ ...base(call, locale, query, [], 0), status: 'unavailable_error' }), started, false);
    }
  }

  private async details(call: AssistantRentalCall): Promise<AssistantToolResult> {
    const listing = await this.listingFrom(call);
    if (!listing) return { content: JSON.stringify({ error: 'listing_not_found' }) };
    const locale = call.locale === 'fr' ? 'fr' : 'en';
    const own = listing.rental_item.business?.id === call.identity.businessId;
    const country = marketCode(call.identity);
    const allow = await this.inspectionFlags.allowSelfBooking(country);
    const ref = refFor(call, listing.id);
    const window = await this.search.cardWindow(listingCountryCode(listing, country), readLatestCardEndAt(listing));
    const presented = withQuestionSay(call, listing, presentRentalDetails({
      listing,
      locale,
      signedIn: !!call.identity.userId,
      own,
      allowSelfBooking: allow,
      ref,
      window,
    }));
    this.emitQuestion(call, listing);
    return presented;
  }

  private async quote(call: AssistantRentalCall): Promise<AssistantToolResult> {
    const listing = await this.listingFrom(call);
    if (!listing) return { content: JSON.stringify({ error: 'listing_not_found' }) };
    const units = Math.max(1, numberOr(call.input.units) || 1);
    this.emitQuestion(call, listing);
    const window = await this.search.cardWindow(listingCountryCode(listing), readLatestCardEndAt(listing));
    const hourly = this.hourlyQuote(call, listing, units, window);
    if (hourly) return quoteResult(hourly);
    return quoteResult(await this.dayQuote(call, listing, units, window));
  }

  private hourlyQuote(
    call: AssistantRentalCall,
    listing: PublicRentalListingRow,
    units: number,
    window: CardWindowFields
  ) {
    const startAt = text(call.input.start_at) || call.turn?.rentalDates?.startAt;
    const endAt = text(call.input.end_at) || call.turn?.rentalDates?.endAt;
    if (!startAt || !endAt) return null;
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { status: 'invalid_dates', date_issue: 'unparseable', ...window };
    }
    const quoted = quoteHourlyWindow({
      perHour: Number(listing.base_price_per_hour) || 0,
      start,
      end,
      units,
      minHours: listing.min_rental_hours || 1,
      maxHours: listing.max_rental_hours,
      unitsAvailable: listing.units_available || 1,
      now: new Date(),
      cardRail: window.payment_rail === 'stripe',
      reviewHours: window.stripe_review_hours,
      latestCardEndAt: window.latest_card_end_at,
    });
    const fits = quoted.ruleViolation !== 'card_window';
    return {
      status: 'ok',
      currency: listing.rental_item.currency,
      ...quoted,
      ...window,
      fits,
      offered_end_at: fits ? null : window.latest_card_end_at,
      estimate: true,
    };
  }

  private async dayQuote(
    call: AssistantRentalCall,
    listing: PublicRentalListingRow,
    units: number,
    window: CardWindowFields
  ) {
    const range = this.rangeFrom(call, window.timezone);
    if (!range || range.status !== 'ok') {
      return { status: range?.status ?? 'needs_dates', date_issue: range && 'dateIssue' in range ? range.dateIssue : null, ...window };
    }
    const priced = pricedRange(range, window);
    const offer = priced.offer;
    if (!offer) return { status: 'ok', ...window, fits: false, offered: null, estimate: true, quote_total: null };
    const free = await this.unitsFree(listing, offer);
    if (units > free) return { status: 'ok', rule_violation: 'units', units_free: free, estimate: true, ...window, fits: priced.fits };
    return dayQuoteBody(listing, units, window, range, { fits: priced.fits, offer }, free);
  }

  private async bookableSuggestion(
    card: CardDateChoice,
    query: string,
    country: string,
    call: AssistantRentalCall
  ): Promise<CardDateChoice> {
    if (!card.guard || card.issue !== 'card_window' || !card.offer) return card;
    const open = await this.rangeOpen(query, country, card.offer, call);
    return open ? card : { ...card, offer: null };
  }

  private async quickDateChips(
    card: CardDateChoice,
    query: string,
    country: string,
    locale: AssistantLocale,
    call: AssistantRentalCall
  ): Promise<AssistantChip[] | undefined> {
    if (card.start || !card.guard) return undefined;
    const now = new Date();
    const kinds = ['today', 'tomorrow', 'weekend'] as const;
    const rows = await Promise.all(kinds.map((kind) => this.openQuickChip(kind, now, card, query, country, locale, call)));
    return [...rows.filter((chip): chip is AssistantChip => !!chip), calendarChip(locale)];
  }

  private async openQuickChip(
    kind: 'today' | 'tomorrow' | 'weekend',
    now: Date,
    card: CardDateChoice,
    query: string,
    country: string,
    locale: AssistantLocale,
    call: AssistantRentalCall
  ): Promise<AssistantChip | null> {
    const range = relativeDayRange(kind, now, card.window.timezone);
    if (!exclusiveRangeFits(range, card.window)) return null;
    if (!(await this.rangeOpen(query, country, range, call))) return null;
    return assistantDateChip(locale, kind, range);
  }

  private async rangeOpen(
    query: string,
    country: string,
    range: { startDate: string; endDate: string },
    call: AssistantRentalCall
  ): Promise<boolean> {
    const scoped = await this.openCount(query, country, range, call, false);
    if (scoped > 0 || !call.identity.market?.state) return scoped > 0;
    return (await this.openCount(query, country, range, call, true)) > 0;
  }

  private async openCount(
    query: string,
    country: string,
    range: { startDate: string; endDate: string },
    call: AssistantRentalCall,
    omitState: boolean
  ): Promise<number> {
    try {
      const page = await this.searchWithRetry(query, country, range.startDate, range.endDate, call, omitState);
      return countAvailable(page);
    } catch (error: any) {
      this.logger.warn(`Date chip search failed: ${error?.message ?? error}`);
      return 0;
    }
  }

  private async cardDates(country: string, checked?: { startDate: string; endDate: string; dayCount: number }): Promise<CardDateChoice> {
    const window = await this.search.cardWindow(country);
    const guard = this.search.cardGuardEnabled ? await this.search.cardGuardEnabled(country) : false;
    if (!guard || !checked || window.payment_rail !== 'stripe' || window.latest_card_end_at == null) {
      return { ...openCardDates(checked, window), guard };
    }
    return clampedCardDates(checked, window, guard);
  }

  private async unitsFree(listing: PublicRentalListingRow, range: { startDate: string; endDate: string }): Promise<number> {
    const windows = await this.windows(listing.id, range.startDate, range.endDate);
    const startMs = Date.parse(`${range.startDate}T00:00:00.000Z`);
    const endMs = Date.parse(`${range.endDate}T00:00:00.000Z`);
    const ok = unitsStillFree(listing.units_available, windows, startMs, endMs, 1);
    return ok ? listing.units_available : 0;
  }

  private async windows(id: string, start: string, end: string): Promise<CapacityWindow[]> {
    const res = await this.hasura.executeQuery<{ rental_booking_windows: Array<{ start_at: string; end_at: string; rental_booking?: { units_booked?: number } }> }>(
      WINDOWS,
      { id, start: `${start}T00:00:00.000Z`, end: `${end}T00:00:00.000Z`, now: new Date().toISOString() }
    );
    return (res.rental_booking_windows ?? []).map((row) => ({
      startMs: Date.parse(row.start_at),
      endMs: Date.parse(row.end_at),
      units: Math.max(1, Number(row.rental_booking?.units_booked) || 1),
    }));
  }

  private rangeFrom(call: AssistantRentalCall, zone: string): ResolvedRentalRange | null {
    const today = marketCalendarDate(new Date(), zone);
    const relative = relativeFrom(call, zone);
    if (relative) return validateExclusiveRange(relative.startDate, relative.endDate, today);
    const start = text(call.input.start_date) || call.turn?.rentalDates?.startDate || '';
    const end = text(call.input.end_date) || call.turn?.rentalDates?.endDate || '';
    if (!start && !end) return null;
    const monthDay = monthDayRange(start, end, today);
    if (monthDay) return monthDay;
    if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return { status: 'invalid_dates', dateIssue: 'unparseable' };
    return validateExclusiveRange(start, end, today);
  }

  private async matchingPage(query: string, country: string, start: string | undefined, end: string | undefined, call: AssistantRentalCall) {
    const categories = await this.categories(country);
    const terms = rentalSearchTerms(query, text(call.turn?.userText), categories);
    let last: RentalSearchPage = emptySearchPage();
    for (const term of terms) {
      const page = await this.pageForTerm(term, country, start, end, call);
      last = page;
      if (page.listings.length) return { page, query: term, categories };
    }
    return { page: last, query: terms[0] || query, categories };
  }

  private async pageForTerm(term: string, country: string, start: string | undefined, end: string | undefined, call: AssistantRentalCall) {
    const scoped = await this.searchWithRetry(term, country, start, end, call, false);
    if (scoped.listings.length || !call.identity.market?.state) return scoped;
    return this.searchWithRetry(term, country, start, end, call, true);
  }

  private async searchWithRetry(
    query: string,
    country: string,
    start?: string,
    end?: string,
    call?: AssistantRentalCall,
    omitState = false
  ) {
    try {
      return await this.timedSearch(query, country, start, end, call, omitState);
    } catch (error: any) {
      if (!retryable(error)) throw error;
      return this.timedSearch(query, country, start, end, call, omitState);
    }
  }

  private timedSearch(
    query: string,
    country: string,
    start?: string,
    end?: string,
    call?: AssistantRentalCall,
    omitState = false
  ) {
    return withTimeout(
      this.search.search({
        q: query,
        country_code: country || undefined,
        state: omitState ? undefined : call?.identity.market?.state || undefined,
        start_date: start,
        end_date: end,
        max_price: numberOr(call?.input.max_price_per_day),
        limit: 6,
        page: 1,
      }),
      SEARCH_MS
    );
  }

  private async askBuyOrRent(call: AssistantRentalCall, query: string, country: string): Promise<boolean> {
    const shopping = await this.shoppingOn(country);
    const textBody = call.turn?.userText || query;
    if (!shouldAskBuyOrRent({ text: textBody, rentMatches: 1, buyMatches: 1, shoppingEnabled: shopping })) return false;
    const [rent, buy] = await Promise.all([
      this.timedSearch(query, country, undefined, undefined, call).catch(() => ({ total: 0 })),
      this.buyItems(query, country, 'en'),
    ]);
    return rent.total > 0 && buy.length > 0;
  }

  private async buyItems(query: string, country: string, locale: AssistantLocale) {
    if (!(await this.shoppingOn(country)) || query.trim().length < 2) return [];
    try {
      const rows = await this.inventory.getInventorySearchSuggestions({ q: query, country_code: country });
      return rows
        .filter((row) => row.kind === 'product')
        .slice(0, 3)
        .map((row) => ({
          id: row.inventoryId,
          title: row.title,
          priceLabel: perDayPriceLabel(row.price, row.currency || 'XAF', locale).replace(/\/(day|jour)$/, ''),
          imageUrl: row.imageUrl,
          href: `/item/${row.inventoryId}`,
        }));
    } catch (error: any) {
      this.logger.warn(`Buy suggestions failed: ${error?.message ?? error}`);
      return [];
    }
  }

  private async categories(country: string) {
    try {
      return await this.search.topCategories({ country_code: country || undefined, limit: 4 });
    } catch {
      return [];
    }
  }

  private async shoppingOn(country: string): Promise<boolean> {
    try {
      const flags = await this.appConfig.getClientFlags(country || undefined);
      return flags.assistant_shopping_v1 === true;
    } catch {
      return false;
    }
  }

  private async listingFrom(call: AssistantRentalCall): Promise<PublicRentalListingRow | null> {
    const id = resolveListingId(call);
    if (!id) return null;
    return this.rentals.getPublicRentalListingById(id, { country_code: marketCode(call.identity) });
  }

  private async storeZero(
    query: string,
    country: string,
    dayCount: number | undefined,
    call: AssistantRentalCall,
    buyMatches: number,
    categoryGuess: string | null
  ) {
    const draft = buildZeroResultDraft(
      {
        query,
        market: country || 'XX',
        dayCount,
        hasBudget: numberOr(call.input.max_price_per_day) != null,
        buyMatches,
        categoryGuess,
      },
      new Date()
    );
    if (!draft) return;
    try {
      await this.hasura.executeQuery(INSERT_ZERO, {
        object: {
          normalized_query: draft.normalizedQuery,
          category_guess: draft.categoryGuess,
          market: draft.market,
          day_bucket: draft.dayBucket,
          has_budget: draft.hasBudget,
          buy_matches: draft.buyMatches,
          created_at: draft.createdAt,
          expires_at: draft.expiresAt,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Zero-result store failed: ${error?.message ?? error}`);
    }
  }

  private finish(
    call: AssistantRentalCall,
    result: AssistantToolResult,
    started: number,
    zero: boolean,
    extra?: { buyMatches?: number; categoryGuess?: string | null }
  ): AssistantToolResult {
    if (result.rental?.refs && call.turn) Object.assign(call.turn.rentalRefs, result.rental.refs);
    this.emitSearch(call, result, Date.now() - started, zero, extra);
    this.emitClarify(call, result);
    return result;
  }

  private emitSearch(
    call: AssistantRentalCall,
    result: AssistantToolResult,
    ms: number,
    zero: boolean,
    extra?: { buyMatches?: number; categoryGuess?: string | null }
  ): void {
    const status = result.rental?.status;
    emitServerSiteEvent(this.siteEvents, zero ? 'assistant.rental.zero_result' : 'assistant.rental.search', {
      intent: 'rent',
      channel: call.turn?.channel || 'app',
      market: marketCode(call.identity) || undefined,
      locale: call.locale === 'fr' ? 'fr' : 'en',
      rental_result: zero ? 'zero' : status,
      has_dates: Boolean(result.rental?.dates),
      has_budget: numberOr(call.input.max_price_per_day) != null,
      day_bucket: rentalDayBucket(result.rental?.dates && 'dayCount' in result.rental.dates ? result.rental.dates.dayCount : null),
      available_count: (result.cards || []).filter((card) => card.rental?.availability === 'available').length,
      latency_bucket: ms > 2000 ? 'slow' : 'fast',
      rental_mode: text(call.input.start_at) ? 'hour' : result.rental?.dates ? 'day' : 'none',
      date_source: dateSource(call),
      units: Math.max(1, numberOr(call.input.units) || 1),
      buy_matches: extra?.buyMatches,
      category_guess: extra?.categoryGuess || undefined,
    });
  }

  private emitClarify(call: AssistantRentalCall, result: AssistantToolResult): void {
    const reason = clarifyReason(result);
    if (!reason) return;
    emitServerSiteEvent(this.siteEvents, 'assistant.rental.clarify', {
      intent: 'rent',
      channel: call.turn?.channel || 'app',
      locale: call.locale === 'fr' ? 'fr' : 'en',
      clarify_reason: reason,
    });
  }

  private emitQuestion(call: AssistantRentalCall, listing: PublicRentalListingRow): void {
    const topic = call.name === 'quote_rental' ? 'price' : rentalQuestionTopic(call.turn?.userText || '');
    const grounded = rentalAnswerGrounded(listing, topic);
    emitServerSiteEvent(this.siteEvents, 'assistant.rental.question', {
      intent: 'question',
      channel: call.turn?.channel || 'app',
      locale: call.locale === 'fr' ? 'fr' : 'en',
      question_topic: topic,
      grounded,
      answer_fallback: grounded ? 'none' : 'request_note',
    });
  }

  private async activeMarketCodes(): Promise<string[]> {
    const res = await this.hasura.executeQuery<{ supported_country_states: Array<{ country_code: string }> }>(
      `query { supported_country_states(where: { service_status: { _eq: "active" } }) { country_code } }`,
      {}
    );
    return [...new Set((res.supported_country_states ?? []).map((row) => String(row.country_code || '').trim().toUpperCase()))];
  }
}

type CardDateChoice = {
  start?: string;
  end?: string;
  dayCount?: number;
  window: CardWindowFields;
  offer: { startDate: string; endDate: string; dayCount: number } | null;
  issue?: 'card_window';
  asked?: { startDate: string; endDate: string };
  guard?: boolean;
};

type RentalSearchPage = Awaited<ReturnType<RentalSearchService['search']>>;

function emptySearchPage(): RentalSearchPage {
  return {
    listings: [],
    total: 0,
    page: 1,
    limit: 6,
    availableCount: 0,
    dates: null,
    mode: 'authorize_upfront',
    latest_card_end_at: null,
    payment_rail: 'mobile_money',
    momo_available: true,
    stripe_review_hours: 72,
    timezone: 'Africa/Douala',
  };
}

function clampedCardDates(
  checked: { startDate: string; endDate: string; dayCount: number },
  window: CardWindowFields,
  guard: boolean
): CardDateChoice {
  const clamped = clampExclusiveRange({
    startDate: checked.startDate,
    endDate: checked.endDate,
    dayCount: checked.dayCount,
    latestCardEndAt: window.latest_card_end_at,
    zone: window.timezone,
    today: marketCalendarDate(new Date(), window.timezone),
  });
  if (clamped.fits) return { ...openCardDates(checked, window), guard };
  const today = marketCalendarDate(new Date(), window.timezone);
  return {
    start: checked.startDate,
    end: checked.endDate,
    dayCount: checked.dayCount,
    issue: 'card_window',
    window,
    asked: { startDate: checked.startDate, endDate: checked.endDate },
    offer: latestFittingStay(window, today),
    guard,
  };
}

function latestFittingStay(window: CardWindowFields, today: string): CardWindowOffer | null {
  if (!window.latest_card_end_at) return null;
  const cap = latestExclusiveEndDate(window.latest_card_end_at, window.timezone);
  if (cap <= today) return null;
  return clampExclusiveRange({
    startDate: today,
    endDate: cap,
    dayCount: 1,
    latestCardEndAt: window.latest_card_end_at,
    zone: window.timezone,
    today,
  }).offer;
}

function exclusiveRangeFits(
  range: { startDate: string; endDate: string; dayCount: number },
  window: CardWindowFields
): boolean {
  if (!stripeCutoff(window)) return true;
  const today = marketCalendarDate(new Date(), window.timezone);
  return clampExclusiveRange({
    startDate: range.startDate,
    endDate: range.endDate,
    dayCount: range.dayCount,
    latestCardEndAt: window.latest_card_end_at,
    zone: window.timezone,
    today,
  }).fits;
}

function stripeCutoff(window: CardWindowFields): boolean {
  return window.payment_rail === 'stripe' && window.latest_card_end_at != null;
}

function countAvailable(page: { availableCount?: number; listings?: Array<{ available?: boolean | null }> }): number {
  if (typeof page.availableCount === 'number') return page.availableCount;
  return (page.listings ?? []).filter((hit) => hit.available === true).length;
}

function openCardDates(
  checked: { startDate: string; endDate: string; dayCount: number } | undefined,
  window: CardWindowFields
): CardDateChoice {
  return {
    start: checked?.startDate,
    end: checked?.endDate,
    dayCount: checked?.dayCount,
    window,
    offer: checked ?? null,
  };
}

function pricedRange(
  range: { startDate: string; endDate: string; dayCount: number },
  window: CardWindowFields
) {
  if (window.payment_rail !== 'stripe' || window.latest_card_end_at == null) return { fits: true, offer: range };
  return clampExclusiveRange({
    startDate: range.startDate,
    endDate: range.endDate,
    dayCount: range.dayCount,
    latestCardEndAt: window.latest_card_end_at,
    zone: window.timezone,
    today: marketCalendarDate(new Date(), window.timezone),
  });
}

function dayQuoteBody(
  listing: PublicRentalListingRow,
  units: number,
  window: CardWindowFields,
  asked: { startDate: string; endDate: string },
  priced: { fits: boolean; offer: { startDate: string; endDate: string; dayCount: number } },
  free: number
) {
  const offer = priced.offer;
  return {
    status: 'ok',
    quote_total: quoteDayTotal(Number(listing.base_price_per_day) || 0, offer.dayCount, units),
    currency: listing.rental_item.currency,
    day_count: offer.dayCount,
    start_date: offer.startDate,
    end_date: offer.endDate,
    units_free: free,
    ...window,
    fits: priced.fits,
    offered: priced.fits ? null : offer,
    asked: priced.fits ? null : { startDate: asked.startDate, endDate: asked.endDate },
    estimate: true,
  };
}

function quoteResult(body: Record<string, unknown>): AssistantToolResult {
  const offer = body.offered as { startDate: string; endDate: string; dayCount: number } | null;
  if (body.fits !== false || !offer?.startDate) return { content: JSON.stringify(body) };
  return {
    content: JSON.stringify(body),
    rental: {
      status: 'ok',
      dateIssue: 'card_window',
      dates: offer,
      mode: body.mode === 'charge_at_pickup' ? 'charge_at_pickup' : 'authorize_upfront',
      latest_card_end_at: typeof body.latest_card_end_at === 'string' ? body.latest_card_end_at : null,
      payment_rail: body.payment_rail === 'stripe' ? 'stripe' : 'mobile_money',
      momo_available: body.momo_available === true,
      stripe_review_hours: Number(body.stripe_review_hours) || 72,
      timezone: String(body.timezone || 'Africa/Douala'),
    },
  };
}

function base(call: AssistantRentalCall, locale: AssistantLocale, query: string, hits: RentalSearchHit[], total: number, range?: ResolvedRentalRange | null) {
  return {
    hits,
    total,
    locale,
    query,
    units: Math.max(1, numberOr(call.input.units) || 1),
    signedIn: !!call.identity.userId,
    ownListingIds: [] as string[],
    allowSelfBooking: true,
    status: (range?.status === 'invalid_dates' ? 'invalid_dates' : 'ok') as 'ok' | 'invalid_dates',
    dateIssue: range && range.status === 'invalid_dates' ? range.dateIssue : undefined,
    suggestion: range && range.status === 'invalid_dates' ? range.suggestion : undefined,
  };
}

function relativeFrom(call: AssistantRentalCall, zone: string) {
  if (text(call.input.start_date) || call.turn?.rentalDates?.startDate) return null;
  const token = `${text(call.input.relative)} ${text(call.turn?.userText)}`.toLowerCase();
  if (/\b(this weekend|ce week-end|ce weekend)\b/.test(token)) return relativeDayRange('weekend', new Date(), zone);
  if (/\b(tomorrow|demain)\b/.test(token) && !text(call.input.start_date)) return relativeDayRange('tomorrow', new Date(), zone);
  if (/\b(today|aujourd'hui|aujourd’hui)\b/.test(token) && !text(call.input.start_date)) return relativeDayRange('today', new Date(), zone);
  return null;
}

function monthDayRange(start: string, end: string, today: string): ResolvedRentalRange | null {
  const left = /^(\d{1,2})-(\d{1,2})$/.exec(start);
  const right = /^(\d{1,2})-(\d{1,2})$/.exec(end);
  if (!left || !right) return null;
  const from = resolveMonthDay(Number(left[1]), Number(left[2]), today);
  const to = resolveMonthDay(Number(right[1]), Number(right[2]), today);
  if (from.past || to.past) return { status: 'invalid_dates', dateIssue: 'past' };
  return validateExclusiveRange(from.date, to.date, today);
}

function filterPlace(hits: RentalSearchHit[], place: string) {
  const needle = place.trim().toLowerCase();
  if (!needle) return { hits, ignored: false };
  const matched = hits.filter((hit) => {
    const city = hit.listing.business_location?.address?.city || '';
    const state = hit.listing.business_location?.address?.state || '';
    return `${city} ${state}`.toLowerCase().includes(needle);
  });
  return matched.length ? { hits: matched, ignored: false } : { hits, ignored: true };
}

function filterPrice(hits: RentalSearchHit[], max?: number) {
  if (max == null) return hits;
  return hits.filter((hit) => hit.pricePerDay <= max);
}

function withQuestionSay(
  call: AssistantRentalCall,
  listing: PublicRentalListingRow,
  presented: AssistantToolResult,
): AssistantToolResult {
  const locale = call.locale === 'fr' ? 'fr' : 'en';
  const topic = call.name === 'quote_rental' ? 'price' : rentalQuestionTopic(call.turn?.userText || '');
  const say = rentalQuestionSay(listing, topic, locale);
  return say ? { ...presented, content: mergeSay(presented.content, say) } : presented;
}

function mergeSay(content: string, say: string): string {
  try {
    const body = JSON.parse(content) as Record<string, unknown>;
    body.say = say;
    return JSON.stringify(body);
  } catch (error: any) {
    return content || String(error?.message || '');
  }
}

function resolveListingId(call: AssistantRentalCall): string | null {
  const raw = text(call.input.ref_or_listing_id) || text(call.input.ref);
  if (!raw) return null;
  if (call.turn?.rentalRefs[raw]) return call.turn.rentalRefs[raw];
  return /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
}

function refFor(call: AssistantRentalCall, id: string): string {
  const existing = Object.entries(call.turn?.rentalRefs || {}).find(([, value]) => value === id);
  if (existing) return existing[0];
  return 'r1';
}

function marketCode(identity: AssistantIdentity): string {
  return (identity.market?.country_code || identity.country || '').trim().toUpperCase();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberOr(value: unknown): number | undefined {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
}

function dateSource(call: AssistantRentalCall): 'explicit' | 'relative' | 'chip' | 'none' {
  if (text(call.input.start_date) || text(call.input.start_at)) return 'explicit';
  if (text(call.input.relative)) return 'relative';
  const token = text(call.turn?.userText).toLowerCase();
  const relative = /\b(today|tomorrow|demain|aujourd|weekend|week-end)\b/.test(token);
  if (relative && !call.turn?.rentalDates?.startDate) return 'relative';
  if (call.turn?.rentalDates?.startDate) return 'chip';
  return 'none';
}

function clarifyReason(result: AssistantToolResult): string | null {
  const rental = result.rental;
  if (rental?.dateIssue === 'card_window') return 'card_window';
  if (rental?.status === 'buy_or_rent') return 'buy_or_rent';
  if (rental?.status === 'needs_dates') return 'missing_dates';
  if (rental?.status === 'invalid_dates') return rental.dateIssue || 'vague';
  return null;
}

function guessCategory(query: string, categories: Array<{ name: string }>): string | null {
  const body = query.toLowerCase();
  const hit = categories.find((row) => row.name && body.includes(row.name.toLowerCase()));
  return hit?.name ?? null;
}

function retryable(error: { status?: number; getStatus?: () => number; message?: string }): boolean {
  const status = error.status || error.getStatus?.() || 0;
  return status >= 500 || status === 0 || /timeout/i.test(error.message || '');
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { status: 504 })), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function searchTool(): Tool {
  return {
    toolSpec: {
      name: 'search_rentals',
      description:
        'Search rentals in the customer market. Read only. Pass start_date and end_date as exclusive YYYY-MM-DD, or start_at and end_at ISO with the market offset. Never create a request.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
            start_at: { type: 'string' },
            end_at: { type: 'string' },
            units: { type: 'number' },
            max_price_per_day: { type: 'number' },
            place: { type: 'string', description: 'City or region text. Never a distance.' },
          },
          required: ['query'],
        },
      },
    },
  };
}

function detailsTool(): Tool {
  return {
    toolSpec: {
      name: 'get_rental_listing_details',
      description: 'Read one rental listing by ref (r1) or listing id. Empty fields are null. Do not invent them.',
      inputSchema: {
        json: {
          type: 'object',
          properties: { ref_or_listing_id: { type: 'string' } },
          required: ['ref_or_listing_id'],
        },
      },
    },
  };
}

function quoteTool(): Tool {
  return {
    toolSpec: {
      name: 'quote_rental',
      description: 'Estimate a rental total. The business confirms the price. Read only. Never create a request.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            ref_or_listing_id: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
            start_at: { type: 'string' },
            end_at: { type: 'string' },
            units: { type: 'number' },
          },
          required: ['ref_or_listing_id'],
        },
      },
    },
  };
}

const WINDOWS = `
  query AssistantRentalWindows($id: uuid!, $start: timestamptz!, $end: timestamptz!, $now: timestamptz!) {
    rental_booking_windows(
      where: {
        start_at: { _lt: $end }
        end_at: { _gt: $start }
        rental_booking: {
          rental_location_listing_id: { _eq: $id }
          _or: [
            { status: { _in: [reserved, confirmed, active, awaiting_return] } }
            { _and: [{ status: { _eq: proposed } }, { contract_expires_at: { _gt: $now } }] }
          ]
        }
      }
    ) { start_at end_at rental_booking { units_booked } }
  }
`;

const INSERT_ZERO = `
  mutation InsertAssistantRentalZero($object: assistant_rental_zero_results_insert_input!) {
    insert_assistant_rental_zero_results_one(object: $object) { id }
  }
`;
