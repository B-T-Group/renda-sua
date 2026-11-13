/**
 * Full-screen captures of the assistant rentals UI.
 * Intercepts chat and request APIs. Not imported by app entry points.
 *
 * Usage: node scripts/capture-assistant-rentals.mjs
 * Env: WEB_URL (default http://localhost:4200), MOBILE_URL (default http://localhost:8081)
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const OUT = '/opt/cursor/artifacts/assistant-rentals-v1';
const WEB = process.env.WEB_URL || 'http://localhost:4200';
const MOBILE = process.env.MOBILE_URL || 'http://localhost:8081';
const LISTING = '11111111-1111-4111-8111-111111111111';

function moneyCard(input) {
  return {
    kind: 'rental',
    id: input.id,
    title: input.title,
    href: `/rentals/${input.listingId}?start_date=2026-11-17&end_date=2026-11-18&openRequest=1`,
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
      calendarDate: '2026-11-17',
      requestedStartAt: '2026-11-17T07:00:00.000Z',
      requestedEndAt: '2026-11-18T17:00:00.000Z',
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

async function installRoutes(page, fr) {
  await page.route('http://localhost:3000/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return fulfill(route, '', 204);
    return route.fallback();
  });
  await page.route('**/app-config/client-flags**', (route) => fulfill(route, flagsBody()));
  await page.route('**/auth/login/refresh', (route) =>
    fulfill(route, {
      access_token: 'capture-access',
      id_token: jwt({ sub: 'auth0|capture', email: 'renter@example.com', email_verified: true }),
      token_type: 'Bearer',
      expires_in: 3600,
    })
  );
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
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('saved', name);
}

async function sendWeb(page, text) {
  const input = page.getByPlaceholder(/Ask about an item|Demandez|commande ou la livraison|order or delivery/i);
  await input.waitFor({ timeout: 20000 });
  await input.click();
  await input.fill(text);
  await page.keyboard.press('Enter');
}

async function captureWeb() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  for (const fr of [false, true]) {
    const lang = fr ? 'fr' : 'en';
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: fr ? 'fr-FR' : 'en-US',
      deviceScaleFactor: 2,
    });
    await context.addInitScript((language) => {
      localStorage.setItem('i18nextLng', language);
    }, lang);
    const page = await context.newPage();
    await installRoutes(page, fr);
    await page.goto(`${WEB}/assistant`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByTestId('assistant-page').waitFor({ timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);

    await sendWeb(page, fr ? 'Je veux louer un marteau du 17 au 18 novembre' : 'I want to rent a hammer from 17th - 18th of November');
    await page.getByText(fr ? 'Demander la location' : 'Request rental').first().waitFor({ timeout: 20000 });
    if (lang === 'en') await shoot(page, '01-found-en');
    else await shoot(page, '01-found-fr');

    await page.getByRole('button', { name: /Nov 17|17 nov/i }).click();
    await page.getByRole('dialog').waitFor({ timeout: 10000 });
    await shoot(page, fr ? '05-date-editor-fr' : '05-date-editor-en');
    await page.keyboard.press('Escape');

    await context.close();
  }

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', deviceScaleFactor: 1 });
  await desktop.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
  const enPage = await desktop.newPage();
  await installRoutes(enPage, false);
  await enPage.goto(`${WEB}/assistant`, { waitUntil: 'domcontentloaded' });
  await enPage.getByTestId('assistant-page').waitFor();
  await sendWeb(enPage, 'I want to rent a hammer from 17th - 18th of November');
  await enPage.getByText('Request rental').first().waitFor();
  await shoot(enPage, '14-web-found-en');
  await desktop.close();

  const desktopFr = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  await desktopFr.addInitScript(() => localStorage.setItem('i18nextLng', 'fr'));
  const frPage = await desktopFr.newPage();
  await installRoutes(frPage, true);
  await frPage.goto(`${WEB}/assistant`, { waitUntil: 'domcontentloaded' });
  await frPage.getByTestId('assistant-page').waitFor();
  await sendWeb(frPage, 'Je veux louer un marteau du 17 au 18 novembre');
  await frPage.getByText('Demander la location').first().waitFor();
  await shoot(frPage, '14-web-found-fr');
  await desktopFr.close();

  await browser.close();
}

async function captureWebStates() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const shots = [
    ['02-booked', 'Can I rent a concrete mixer from 17th to 18th of November?', 'Puis-je louer une bétonnière du 17 au 18 novembre ?', '20 Nov'],
    ['03-notfound', 'I want to rent a pressure washer', 'Je veux louer un nettoyeur', 'View item'],
    ['04-nodates', 'I want to rent a hammer', 'Je veux louer un marteau', 'Today'],
    ['06-invalid-dates', 'Rent a hammer from the 1st of November', 'Louer un marteau le 1er novembre', '17 Nov'],
    ['07-buy-or-rent', 'I need a drill', "J'ai besoin d'une perceuse", 'Rent it'],
    ['08-question-answered', 'What is the deposit?', 'Quelle est la caution ?', '50'],
    ['09-question-empty-field', 'Where do I pick it up?', 'Où est le retrait ?', 'note'],
    ['11-error-check-failed', 'I want to rent a generator', 'Je veux louer un groupe', 'Try again'],
  ];
  for (const [name, en, frText, marker] of shots) {
    for (const fr of [false, true]) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        locale: fr ? 'fr-FR' : 'en-US',
        deviceScaleFactor: 2,
      });
      await context.addInitScript((language) => localStorage.setItem('i18nextLng', language), fr ? 'fr' : 'en');
      const page = await context.newPage();
      await installRoutes(page, fr);
      await page.goto(`${WEB}/assistant`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('assistant-page').waitFor();
      await sendWeb(page, fr ? frText : en);
      await page.waitForTimeout(1200);
      await shoot(page, `${name}-${fr ? 'fr' : 'en'}`);
      await context.close();
    }
    void marker;
  }

  for (const fr of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: fr ? 'fr-FR' : 'en-US',
      deviceScaleFactor: 2,
    });
    await context.addInitScript((language) => localStorage.setItem('i18nextLng', language), fr ? 'fr' : 'en');
    const page = await context.newPage();
    await installRoutes(page, fr);
    await page.goto(`${WEB}/assistant`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('assistant-page').waitFor();
    const pending = sendWeb(page, fr ? 'HOLD-MARTEAU' : 'HOLD-HAMMER');
    await page.getByText(fr ? 'Vérification' : 'Checking').waitFor({ timeout: 8000 }).catch(() => undefined);
    await shoot(page, `10-loading-${fr ? 'fr' : 'en'}`);
    await pending.catch(() => undefined);
    await context.close();
  }

  for (const fr of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: fr ? 'fr-FR' : 'en-US',
      deviceScaleFactor: 2,
    });
    await context.addInitScript((language) => localStorage.setItem('i18nextLng', language), fr ? 'fr' : 'en');
    const page = await context.newPage();
    await installRoutes(page, fr);
    await page.goto(`${WEB}/assistant`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('assistant-page').waitFor();
    await sendWeb(page, fr ? 'NETWORK-ECHELLE' : 'NETWORK-LADDER');
    await page.waitForTimeout(1500);
    await shoot(page, `12-error-network-${fr ? 'fr' : 'en'}`);
    await context.close();
  }

  for (const fr of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: fr ? 'fr-FR' : 'en-US',
      deviceScaleFactor: 2,
    });
    await context.addInitScript((language) => localStorage.setItem('i18nextLng', language), fr ? 'fr' : 'en');
    const page = await context.newPage();
    await installRoutes(page, fr);
    await page.goto(`${WEB}/rentals/requests`, { waitUntil: 'domcontentloaded' });
    await page.getByText(fr ? 'modifié le prix' : 'changed the price').waitFor({ timeout: 20000 });
    await shoot(page, `13-price-changed-${fr ? 'fr' : 'en'}`);
    await context.close();
  }

  const narrow = await browser.newContext({ viewport: { width: 360, height: 800 }, locale: 'en-US', deviceScaleFactor: 2 });
  await narrow.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
  const narrowPage = await narrow.newPage();
  await installRoutes(narrowPage, false);
  await narrowPage.goto(`${WEB}/assistant`, { waitUntil: 'domcontentloaded' });
  await narrowPage.getByTestId('assistant-page').waitFor();
  await sendWeb(narrowPage, 'I want to rent a hammer from 17th - 18th of November');
  await narrowPage.getByText('Request rental').first().waitFor();
  await shoot(narrowPage, '01-found-en-360');
  await narrow.close();

  const narrowFr = await browser.newContext({ viewport: { width: 360, height: 800 }, locale: 'fr-FR', deviceScaleFactor: 2 });
  await narrowFr.addInitScript(() => localStorage.setItem('i18nextLng', 'fr'));
  const narrowFrPage = await narrowFr.newPage();
  await installRoutes(narrowFrPage, true);
  await narrowFrPage.goto(`${WEB}/assistant`, { waitUntil: 'domcontentloaded' });
  await narrowFrPage.getByTestId('assistant-page').waitFor();
  await sendWeb(narrowFrPage, 'Je veux louer un marteau du 17 au 18 novembre');
  await narrowFrPage.getByText('Demander la location').first().waitFor();
  await shoot(narrowFrPage, '01-found-fr-360');
  await narrowFr.close();
  await browser.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const only = process.argv[2];
  if (only !== 'states') await captureWeb();
  if (only !== 'found') await captureWebStates();
  console.log('done', OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

void PROMPTS;
void MOBILE;
