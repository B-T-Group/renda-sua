/**
 * Full-screen captures of the assistant rentals UI.
 * Intercepts chat and request APIs. Not imported by app entry points.
 *
 * Usage: node scripts/capture-assistant-rentals.mjs
 * Env: WEB_URL (default http://localhost:4200), MOBILE_URL (default http://localhost:8081)
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const OUT = '/opt/cursor/artifacts/assistant-rentals-v2';
const WEB = process.env.WEB_URL || 'http://localhost:4200';
const MOBILE = process.env.MOBILE_URL || 'http://localhost:8081';
const LISTING = '11111111-1111-4111-8111-111111111111';

function moneyCard(input) {
  return {
    kind: 'rental',
    id: input.id,
    title: input.title,
    href: input.startDate && input.endDate
      ? `/rentals/${input.listingId}?start_date=${input.startDate}&end_date=${input.endDate}&openRequest=1`
      : `/rentals/${input.listingId}`,
    rental: {
      listingId: input.listingId,
      businessName: input.business,
      city: input.city,
      availability: input.availability,
      dayCount: input.dayCount ?? 1,
      quoteTotal: input.quote,
      perDay: input.perDay,
      deposit: input.deposit,
      currency: 'XAF',
      cta: input.cta || 'request',
      canRequest: input.cta !== 'shift',
      nextAvailableDate: input.next || null,
      shiftStart: input.shiftStart,
      shiftEnd: input.shiftEnd,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  };
}

function found(fr) {
  const reply = fr
    ? "J'ai trouvé 2 marteaux à louer du 17 au 18 nov. 1 autre est réservé, je l'ai mis en dernier."
    : "I found 2 hammers you can rent from 17 Nov to 18 Nov. 1 more is booked, and I've put it last.";
  return {
    reply,
    handoff: false,
    cards: [
      moneyCard({
        id: 'r1',
        listingId: LISTING,
        title: 'Marteau de coffreur 1,2 kg',
        business: 'Quincaillerie Akwa',
        city: 'Akwa, Douala',
        availability: 'available',
        quote: 2500,
        perDay: 2500,
        deposit: 10000,
        startDate: '2026-11-17',
        endDate: '2026-11-18',
      }),
      moneyCard({
        id: 'r2',
        listingId: '22222222-2222-4222-8222-222222222222',
        title: 'Marteau perforateur Bosch GBH 2-26',
        business: 'Location Pro Bonapriso',
        city: 'Bonapriso, Douala',
        availability: 'available',
        quote: 7500,
        perDay: 7500,
        deposit: 45000,
        startDate: '2026-11-17',
        endDate: '2026-11-18',
      }),
      moneyCard({
        id: 'r3',
        listingId: '33333333-3333-4333-8333-333333333333',
        title: 'Masse 5 kg manche fibre',
        business: 'BTP Services Deido',
        city: 'Deido, Douala',
        availability: 'unavailable',
        perDay: 3000,
        deposit: 15000,
        cta: 'shift',
        next: '2026-11-20',
        shiftStart: '2026-11-20',
        shiftEnd: '2026-11-21',
      }),
    ],
    rental: {
      status: 'ok',
      dates: { startDate: '2026-11-17', endDate: '2026-11-18', dayCount: 1 },
      footnote: 'estimate',
      showAllCount: 3,
      showAllHref: '/rentals?search=hammer',
    },
  };
}

function unfit(fr) {
  return {
    reply: fr
      ? 'Avec une carte, cette location doit se terminer le 16 nov. · 13:00. Voici des dates possibles :'
      : 'With a card, this rental must end by 16 Nov · 13:00. Here are dates that work:',
    handoff: false,
    cards: [
      moneyCard({
        id: 'r1',
        listingId: LISTING,
        title: 'Marteau de coffreur 1,2 kg',
        business: 'Quincaillerie Akwa',
        city: 'Akwa, Douala',
        availability: 'available',
        quote: 5000,
        perDay: 2500,
        deposit: 10000,
        startDate: '2026-11-14',
        endDate: '2026-11-16',
        dayCount: 2,
      }),
    ],
    rental: {
      status: 'ok',
      dateIssue: 'card_window',
      mode: 'authorize_upfront',
      latest_card_end_at: '2026-11-16T12:00:00.000Z',
      payment_rail: 'stripe',
      momo_available: false,
      dates: { startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 },
      footnote: 'estimate',
    },
  };
}

function booked(fr) {
  return {
    reply: fr
      ? "J'ai trouvé une bétonnière, mais elle est réservée du 17 au 18 nov. Elle est libre à partir du 20 nov."
      : "I found a concrete mixer, but it's booked from 17 Nov to 18 Nov. It's free again from 20 Nov.",
    handoff: false,
    cards: [
      moneyCard({
        id: 'r1',
        listingId: LISTING,
        title: 'Bétonnière 160 L',
        business: 'BTP Services Deido',
        city: 'Deido, Douala',
        availability: 'unavailable',
        perDay: 15000,
        deposit: 50000,
        cta: 'shift',
        next: '2026-11-20',
        shiftStart: '2026-11-20',
        shiftEnd: '2026-11-21',
      }),
    ],
    rental: {
      status: 'ok',
      dates: { startDate: '2026-11-17', endDate: '2026-11-18', dayCount: 1 },
      chips: [{ id: 'similar', label: fr ? 'Articles similaires' : 'Similar items', action: 'category', message: 'mixer' }],
    },
  };
}

function notFound(fr) {
  return {
    reply: fr
      ? "Je n'ai pas trouvé de nettoyeur haute pression à louer au Cameroun pour le moment.\n\nVous pouvez en acheter un. J'ai trouvé 2 nettoyeurs en vente.\n\nAutres choses à louer :"
      : "I couldn't find a pressure washer to rent in Cameroon right now.\n\nYou can buy one instead. I found 2 pressure washers for sale.\n\nOther things you can rent:",
    handoff: false,
    cards: [
      { kind: 'item', id: 'b1', title: 'Nettoyeur haute pression Kärcher', priceLabel: '65\u00A0000\u00A0FCFA', href: '/item/b1' },
      { kind: 'item', id: 'b2', title: 'Nettoyeur haute pression 1 600 W', priceLabel: '42\u00A0500\u00A0FCFA', href: '/item/b2' },
    ],
    rental: {
      status: 'ok',
      dates: { startDate: '2026-11-17', endDate: '2026-11-18', dayCount: 1 },
      chips: [
        { id: 'clean', label: fr ? 'Matériel de nettoyage' : 'Cleaning equipment', action: 'category', message: 'cleaning' },
        { id: 'tools', label: fr ? 'Outils' : 'Tools', action: 'category', message: 'tools' },
        { id: 'garden', label: fr ? 'Jardin' : 'Garden', action: 'category', message: 'garden' },
      ],
    },
  };
}

function noDates(fr) {
  return {
    reply: fr ? 'Pour quelles dates voulez-vous le marteau ?' : 'Which dates do you want the hammer for?',
    handoff: false,
    cards: [
      moneyCard({
        id: 'r1',
        listingId: LISTING,
        title: 'Marteau de coffreur 1,2 kg',
        business: 'Quincaillerie Akwa',
        city: 'Akwa, Douala',
        availability: 'no_dates',
        perDay: 2500,
        deposit: 10000,
        cta: 'request',
      }),
    ],
    rental: {
      status: 'needs_dates',
      chips: [
        { id: 'today', label: fr ? "Aujourd'hui" : 'Today', action: 'dates', message: fr ? "Aujourd'hui" : 'Today' },
        { id: 'tomorrow', label: fr ? 'Demain' : 'Tomorrow', action: 'dates', message: fr ? 'Demain' : 'Tomorrow' },
        { id: 'weekend', label: fr ? 'Ce week-end' : 'This weekend', action: 'dates', message: fr ? 'Ce week-end' : 'This weekend' },
        { id: 'calendar', label: fr ? 'Choisir les dates' : 'Choose dates', action: 'calendar' },
      ],
    },
  };
}

function invalid(fr) {
  return {
    reply: fr
      ? 'Le 1er novembre est déjà passé. La fin doit être après le début. Essayez cette plage.'
      : '1 November is already past. The end date has to be after the start. Try this range.',
    handoff: false,
    cards: [],
    rental: {
      status: 'invalid_dates',
      dateIssue: 'past',
      chips: [{
        id: 'suggested-range',
        label: fr ? '17 nov. → 20 nov. · 3 jours' : '17 Nov → 20 Nov · 3 days',
        action: 'dates',
        startDate: '2026-11-17',
        endDate: '2026-11-20',
        message: '17 Nov → 20 Nov',
      }],
    },
  };
}

function buyOrRent(fr) {
  return {
    reply: fr ? 'Vous voulez louer une perceuse ou l’acheter ?' : 'Do you want to rent a drill or buy one?',
    handoff: false,
    cards: [],
    rental: {
      status: 'buy_or_rent',
      chips: [
        { id: 'rent', label: fr ? 'Louer' : 'Rent it', action: 'rent', message: fr ? 'Louer une perceuse' : 'Rent a drill' },
        { id: 'buy', label: fr ? "L'acheter" : 'Buy it', action: 'buy', message: fr ? 'Acheter une perceuse' : 'Buy a drill' },
      ],
    },
  };
}

function question(fr) {
  return {
    reply: fr
      ? 'La caution de la bétonnière est de 50 000 FCFA. Le retrait se fait à Deido.'
      : 'The deposit for the mixer is 50 000 FCFA. Pickup is in Deido.',
    handoff: false,
    cards: [
      moneyCard({
        id: 'r1',
        listingId: LISTING,
        title: 'Bétonnière 160 L',
        business: 'BTP Services Deido',
        city: 'Deido, Douala',
        availability: 'available',
        quote: 15000,
        perDay: 15000,
        deposit: 50000,
        startDate: '2026-11-17',
        endDate: '2026-11-18',
      }),
    ],
    rental: {
      status: 'ok',
      dates: { startDate: '2026-11-17', endDate: '2026-11-18', dayCount: 1 },
      footnote: 'estimate',
    },
  };
}

function emptyField(fr) {
  return {
    reply: fr
      ? "L'annonce ne précise pas le lieu de retrait. Vous pouvez ajouter une note à la demande."
      : "The listing doesn't say where to pick it up. You can add a note on the request.",
    handoff: false,
    cards: [
      moneyCard({
        id: 'r1',
        listingId: LISTING,
        title: 'Marteau de coffreur 1,2 kg',
        business: 'Quincaillerie Akwa',
        city: 'Akwa, Douala',
        availability: 'available',
        perDay: 2500,
        deposit: 10000,
        startDate: '2026-11-17',
        endDate: '2026-11-18',
      }),
    ],
    rental: { status: 'ok' },
  };
}

function failed(fr) {
  return {
    reply: fr ? "Je n'ai pas pu vérifier la disponibilité." : "I couldn't check availability. Try again.",
    handoff: false,
    cards: [],
    rental: {
      status: 'unavailable_error',
      chips: [{ id: 'retry', label: fr ? 'Réessayer' : 'Try again', action: 'retry', message: 'retry' }],
    },
  };
}

const PROMPTS = {
  found: ['hammer from 17', 'marteau du 17'],
  booked: ['concrete mixer', 'bétonnière'],
  notFound: ['pressure washer', 'nettoyeur'],
  noDates: ['rent a hammer', 'louer un marteau'],
  invalid: ['1st of November', '1er novembre'],
  buyOrRent: ['need a drill', "besoin d'une perceuse"],
  question: ['what is the deposit', 'quelle est la caution'],
  empty: ['where do I pick', 'où est le retrait'],
  loading: ['HOLD-HAMMER', 'HOLD-MARTEAU'],
  failed: ['rent a generator', 'louer un groupe'],
  network: ['NETWORK-LADDER', 'NETWORK-ECHELLE'],
  unfit: ['17th to 18th', 'par carte'],
};

function replyFor(text, fr) {
  const body = text.toLowerCase();
  if (body.includes('hold-')) return { hold: true, payload: found(fr) };
  if (body.includes('network-')) return { abort: true };
  if (body.includes('concrete') || body.includes('béton') || body.includes('beton')) return { payload: booked(fr) };
  if (body.includes('pressure') || body.includes('nettoyeur')) return { payload: notFound(fr) };
  if (body.includes('1st') || body.includes('1er')) return { payload: invalid(fr) };
  if (body.includes('drill') || body.includes('perceuse')) return { payload: buyOrRent(fr) };
  if (body.includes('deposit') || body.includes('caution')) return { payload: question(fr) };
  if (body.includes('pick') || body.includes('retrait')) return { payload: emptyField(fr) };
  if (body.includes('generator') || body.includes('groupe')) return { payload: failed(fr) };
  if (body.includes('17th to 18th') || body.includes('par carte')) return { payload: unfit(fr) };
  const undatedHammer = (body.includes('rent a hammer') || body.includes('louer un marteau')) && !/\d/.test(body);
  if (undatedHammer) return { payload: noDates(fr) };
  return { payload: found(fr) };
}

function lastUserText(raw) {
  try {
    const body = JSON.parse(raw || '{}');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const user = [...messages].reverse().find((row) => row.role === 'user');
    return String(user?.content || '');
  } catch {
    return '';
  }
}

function flagsBody() {
  return JSON.stringify({
    success: true,
    message: 'ok',
    data: {
      assistant_launcher_v1: true,
      assistant_shopping_v1: true,
      assistant_rentals_enabled: false,
      floating_nav_enabled: false,
      reels_enabled: false,
    },
  });
}

function jwt(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${body}.sig`;
}

function priceRequest() {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    status: 'available',
    created_at: '2026-11-13T10:00:00.000Z',
    expires_at: '2026-12-01T10:00:00.000Z',
    units_requested: 1,
    quoted_total: 2500,
    price_change_seen_at: null,
    rental_pricing_snapshot: { total: 3000, currency: 'XAF' },
    rental_selection_windows: [{
      billing: 'all_day',
      calendar_date: '2026-11-17',
      start_at: '2026-11-17T08:00:00.000Z',
      end_at: '2026-11-18T08:00:00.000Z',
    }],
    rental_location_listing: {
      id: LISTING,
      base_price_per_day: 3000,
      base_price_per_hour: 500,
      business_location: { name: 'Quincaillerie Akwa', address: { city: 'Akwa' } },
      rental_item: {
        name: 'Marteau de coffreur 1,2 kg',
        currency: 'XAF',
        business: { name: 'Quincaillerie Akwa' },
      },
    },
    rental_booking: null,
  };
}

function fulfill(route, body, status = 200) {
  const origin = route.request().headers().origin || 'http://localhost:4200';
  const headers = {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers':
      route.request().headers()['access-control-request-headers'] ||
      'content-type,authorization,x-requested-with,x-client-platform,x-anonymous-id,x-user-id',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'content-type': 'application/json',
  };
  return route.fulfill({
    status,
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function installRoutes(page, fr, options = {}) {
  const authed = options.auth === true;
  await page.route('http://localhost:3000/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return fulfill(route, '', 204);
    return route.fallback();
  });
  await page.route('**/app-config/client-flags**', (route) => fulfill(route, flagsBody()));
  await page.route('**/auth/login/refresh', (route) => {
    if (!authed) return fulfill(route, { message: 'no session' }, 401);
    return fulfill(route, {
      access_token: 'capture-access',
      id_token: jwt({ sub: 'auth0|capture', email: 'renter@example.com', email_verified: true }),
      token_type: 'Bearer',
      expires_in: 3600,
    });
  });
  await page.route('**/users/me', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfill(route, {
      success: true,
      active_persona: 'client',
      user: {
        id: '55555555-5555-4555-8555-555555555555',
        email: 'renter@example.com',
        email_verified: true,
        first_name: 'Amina',
        personas: ['client'],
        client: { id: '66666666-6666-4666-8666-666666666666' },
      },
    });
  });
  await page.route('**/rentals/client/requests**', (route) =>
    fulfill(route, { success: true, data: { requests: [priceRequest()] } })
  );
  await page.route('**/rentals/client/bookings**', (route) =>
    fulfill(route, { success: true, data: { bookings: [] } })
  );
  await page.route('**/rentals/requests/**/price-change-seen', (route) => fulfill(route, { success: true }));
  await page.route('**/assistant/chat**', async (route) => {
    if (route.request().method() === 'OPTIONS') return fulfill(route, '', 204);
    const text = lastUserText(route.request().postData());
    console.log('chat', text.slice(0, 80));
    const decision = replyFor(text, fr);
    if (decision.abort) {
      await route.abort('failed');
      return;
    }
    if (decision.hold) await new Promise((resolve) => setTimeout(resolve, 2500));
    await fulfill(route, decision.payload);
  });
}

async function shoot(page, name) {
  await loadIconFonts(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('saved', name);
}

async function loadIconFonts(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].filter((face) => /icon|material|symbols/i.test(face.family));
    await Promise.all(faces.map((face) => face.load().catch(() => undefined)));
  });
}

/** The header keeps “Thinking…” for at least 400 ms after a fast reply, and the bubble fades in. A network failure then reads Offline. */
async function waitSettled(page, fr) {
  const thinking = fr ? 'Réflexion' : 'Thinking';
  await page.waitForFunction((label) => {
    const title = [...document.querySelectorAll('h1')].find((el) => /Assistant/.test(el.textContent || ''));
    const status = title?.parentElement?.querySelector('p');
    return !!status && !(status.textContent || '').includes(label);
  }, thinking, { timeout: 10000 });
  await waitOpaque(page, '[data-chat-item]');
}

async function waitOpaque(page, selector) {
  await page.waitForFunction((sel) => {
    const nodes = [...document.querySelectorAll(sel)];
    if (!nodes.length) return false;
    return nodes.every((node) => {
      let current = node;
      while (current) {
        if (Number(getComputedStyle(current).opacity) < 0.99) return false;
        current = current.parentElement;
      }
      return true;
    });
  }, selector, { timeout: 8000 });
}

async function sendWeb(page, text) {
  const input = page.locator('textarea[name="message"], input[name="message"]').first();
  await input.waitFor({ timeout: 20000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('textarea[name="message"], input[name="message"]');
    return !!el && !el.disabled;
  }, null, { timeout: 20000 });
  await input.click();
  await input.fill(text);
  await page.keyboard.press('Enter');
}

const CHAT_SHOTS = [
  { id: '01-found', en: 'I want to rent a hammer from 17th - 18th of November', fr: 'Je veux louer un marteau du 17 au 18 novembre', waitEn: 'Request rental', waitFr: 'Demander la location', editor: true },
  { id: '02-booked', en: 'Can I rent a concrete mixer from 17th to 18th of November?', fr: 'Puis-je louer une bétonnière du 17 au 18 novembre ?', waitEn: '20 Nov', waitFr: '20 nov' },
  { id: '03-notfound', en: 'I want to rent a pressure washer', fr: 'Je veux louer un nettoyeur', waitEn: 'pressure washer', waitFr: 'nettoyeur' },
  { id: '04-nodates', en: 'I want to rent a hammer', fr: 'Je veux louer un marteau', waitEn: 'Today', waitFr: "Aujourd'hui" },
  { id: '06-invalid-dates', en: 'Rent a hammer from the 1st of November', fr: 'Louer un marteau le 1er novembre', waitEn: 'already past', waitFr: 'déjà passé' },
  { id: '07-buy-or-rent', en: 'I need a drill', fr: "J'ai besoin d'une perceuse", waitEn: 'Rent it', waitFr: 'Louer' },
  { id: '08-question-answered', en: 'What is the deposit?', fr: 'Quelle est la caution ?', waitEn: '50', waitFr: '50' },
  { id: '08-assistant-unfit', en: 'I want to rent a hammer from 17th to 18th of November', fr: 'Je veux louer un marteau du 17 au 18 novembre par carte', waitEn: 'Here are dates that work', waitFr: 'Voici des dates possibles' },
  { id: '09-question-empty-field', en: 'Where do I pick it up?', fr: 'Où est le retrait ?', waitEn: 'note', waitFr: 'note' },
  { id: '11-error-check-failed', en: 'I want to rent a generator', fr: 'Je veux louer un groupe', waitEn: 'Try again', waitFr: 'Réessayer' },
];

const SURFACES = [
  { kind: 'phone', width: 390, height: 844, suffix: '', scale: 2 },
  { kind: 'phone', width: 360, height: 800, suffix: '-360', scale: 2 },
  { kind: 'web', width: 1440, height: 900, suffix: '', scale: 1 },
];

function fileName(id, lang, surface) {
  if (surface.kind === 'web') return `14-web-${id.replace(/^\d+-/, '')}-${lang}`;
  return `${id}-${lang}${surface.suffix}`;
}

async function captureAll() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const only = process.env.CAPTURE_ONLY || '';
  for (const surface of SURFACES) {
    for (const fr of [false, true]) {
      if (!only || only === 'chat') {
        await captureChat(browser, surface, fr);
        await captureLoading(browser, surface, fr);
        await captureNetwork(browser, surface, fr);
      }
      if (!only || only === 'price') await capturePrice(browser, surface, fr);
    }
  }
  await browser.close();
}

async function gotoApp(page, path) {
  const response = await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (response && response.status() < 400) return;
  await page.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((next) => {
    window.history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function captureChat(browser, surface, fr) {
  const { page, context } = await openChat(browser, surface, fr);
  for (const shot of CHAT_SHOTS) {
    await page.evaluate(() => sessionStorage.clear()).catch(() => undefined);
    await gotoApp(page, '/assistant');
    await page.getByTestId('assistant-page').waitFor({ timeout: 30000 });
    await sendWeb(page, fr ? shot.fr : shot.en);
    await page.getByText(fr ? shot.waitFr : shot.waitEn).first().waitFor({ timeout: 20000 });
    await waitSettled(page, fr);
    await shoot(page, fileName(shot.id, fr ? 'fr' : 'en', surface));
    if (shot.editor) await captureEditor(page, surface, fr);
  }
  await context.close();
}

async function captureEditor(page, surface, fr) {
  await page.getByRole('button', { name: /Nov 17|17 nov/i }).click();
  await page.getByRole('dialog').waitFor({ timeout: 10000 });
  await shoot(page, fileName('05-date-editor', fr ? 'fr' : 'en', surface));
  await page.keyboard.press('Escape');
}

async function captureLoading(browser, surface, fr) {
  const { page, context } = await openChat(browser, surface, fr);
  const pending = sendWeb(page, fr ? 'HOLD-MARTEAU louer un marteau' : 'HOLD-HAMMER rent a hammer');
  await page.getByText(fr ? 'Vérification' : 'Checking').first().waitFor({ timeout: 15000 });
  await waitOpaque(page, '[role="status"]');
  await shoot(page, fileName('10-loading', fr ? 'fr' : 'en', surface));
  await pending;
  await context.close();
}

async function captureNetwork(browser, surface, fr) {
  const { page, context } = await openChat(browser, surface, fr);
  await sendWeb(page, fr ? 'NETWORK-ECHELLE' : 'NETWORK-LADDER');
  await page.getByText(fr ? 'Message non envoyé' : 'Message not sent').first().waitFor({ timeout: 15000 });
  await waitSettled(page, fr);
  await shoot(page, fileName('12-error-network', fr ? 'fr' : 'en', surface));
  await context.close();
}

async function capturePrice(browser, surface, fr) {
  const context = await newContext(browser, surface, fr);
  const page = await context.newPage();
  await installRoutes(page, fr, { auth: true });
  await gotoApp(page, '/rentals/requests');
  await page.getByText(fr ? 'modifié le prix' : 'changed the price').first().waitFor({ timeout: 20000 });
  const totalBottom = await page.evaluate(() => {
    const total = [...document.querySelectorAll('h6')].find((el) => /FCFA/.test(el.textContent || ''));
    return total ? total.getBoundingClientRect().bottom : 0;
  });
  if (totalBottom > 760) {
    await page.mouse.move(180, 420);
    await page.mouse.wheel(0, totalBottom - 640);
    await page.waitForTimeout(250);
  }
  await shoot(page, fileName('13-price-changed', fr ? 'fr' : 'en', surface));
  await context.close();
}

async function openChat(browser, surface, fr) {
  const context = await newContext(browser, surface, fr);
  const page = await context.newPage();
  await installRoutes(page, fr);
  const refresh = page.waitForResponse((res) => res.url().includes('/auth/login/refresh'), { timeout: 20000 });
  await gotoApp(page, '/assistant');
  await page.getByTestId('assistant-page').waitFor({ timeout: 30000 });
  await refresh.catch(() => undefined);
  return { page, context };
}

function newContext(browser, surface, fr) {
  const context = browser.newContext({
    viewport: { width: surface.width, height: surface.height },
    locale: fr ? 'fr-FR' : 'en-US',
    deviceScaleFactor: surface.scale,
  });
  return context.then(async (ready) => {
    await ready.addInitScript((language) => {
      localStorage.setItem('i18nextLng', language);
      ['rendasua.assistant.chat.v1', 'rendasua.assistant.thread_id.v1', 'rendasua.assistant.last_activity.v1', 'rendasua.assistant.owner.v1', 'rendasua.assistant.pending.v1'].forEach((key) => sessionStorage.removeItem(key));
    }, fr ? 'fr' : 'en');
    return ready;
  });
}


async function main() {
  await mkdir(OUT, { recursive: true });
  await captureAll();
  console.log('done', OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

void PROMPTS;
void MOBILE;
