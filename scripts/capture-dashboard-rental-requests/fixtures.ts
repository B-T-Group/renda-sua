/** Fixture payloads for the capture harness. Not imported by the apps. */

export type Scene = 'dashboard' | 'empty' | 'after' | 'expired' | 'renter' | 'list';

export function torontoToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function allDay(day: string) {
  return {
    billing: 'all_day' as const,
    calendar_date: day,
    start_at: `${day}T05:00:00.000Z`,
    end_at: `${addDays(day, 1)}T04:59:00.000Z`,
  };
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function request(input: {
  id: string;
  name: string;
  renter: [string, string];
  days: string[];
  total: number;
  respondInHours: number;
  updated?: boolean;
}) {
  const windows = input.days.map(allDay);
  return {
    id: input.id,
    created_at: new Date().toISOString(),
    status: 'pending',
    rental_selection_windows: windows,
    rental_pricing_snapshot: { version: 4, currency: 'CAD', total: input.total, securityDeposit: 0 },
    units_requested: 1,
    quoted_total: input.total,
    requested_start_at: windows[0].start_at,
    respond_by: hoursFromNow(input.respondInHours),
    respond_window: 'sla',
    listing_timezone: 'America/Toronto',
    dates_available: true,
    payment_rail: 'stripe',
    change_summary: input.updated
      ? { fields: ['dates'], dates: { from: [allDay(addDays(input.days[0], -1))], to: windows } }
      : null,
    rental_location_listing: {
      id: `listing-${input.id}`,
      base_price_per_hour: 12,
      base_price_per_day: 45,
      security_deposit_amount: 0,
      business_location: { name: 'Atelier Nord', address: { city: 'Toronto', country: 'CA' } },
      rental_item: {
        name: input.name,
        currency: 'CAD',
        business: { name: 'Atelier Nord' },
        rental_item_images: [],
      },
    },
    client: { user: { first_name: input.renter[0], last_name: input.renter[1] } },
  };
}

export function pendingRequests() {
  const today = torontoToday();
  return [
    request({
      id: 'godox',
      name: 'Godox lighting kit',
      renter: ['Amina', 'Traoré'],
      days: [today],
      total: 45,
      respondInHours: 2,
    }),
    request({
      id: 'canon',
      name: 'Canon EOS R8',
      renter: ['Marie', 'Dubois'],
      days: [addDays(today, 3), addDays(today, 4)],
      total: 90,
      respondInHours: 22,
    }),
    request({
      id: 'dji',
      name: 'DJI Mini 4 Pro',
      renter: ['James', 'Park'],
      days: [addDays(today, 7)],
      total: 45,
      respondInHours: 19,
      updated: true,
    }),
  ];
}

export function sceneName(): Scene {
  const value = (globalThis as { __SCENE?: string }).__SCENE;
  if (value === 'empty' || value === 'after' || value === 'expired' || value === 'renter' || value === 'list') {
    return value;
  }
  return 'dashboard';
}

export function dashboardPayload() {
  const scene = sceneName();
  if (scene === 'empty') return { requests: [], expiryNotices: [] };
  const rows = pendingRequests();
  if (scene === 'after') return { requests: rows.slice(1), expiryNotices: [] };
  if (scene === 'expired') {
    return {
      requests: rows.slice(1),
      expiryNotices: [{ id: 'godox', itemName: 'Godox lighting kit', renterName: 'Amina Traoré', window: 'sla' as const }],
    };
  }
  return { requests: rows, expiryNotices: [] };
}

export function listPayload() {
  const scene = sceneName();
  if (scene === 'empty') return [];
  if (scene === 'after' || scene === 'expired') return pendingRequests().slice(1);
  return pendingRequests();
}

export function renterRequest() {
  const start = addDays(torontoToday(), 3);
  return {
    id: 'godox-renter',
    created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    status: 'unavailable',
    unavailable_reason_code: 'no_response',
    quoted_total: 45,
    units_requested: 1,
    rental_pricing_snapshot: { version: 4, currency: 'CAD', total: 45 },
    rental_selection_windows: [allDay(start)],
    requested_start_at: `${start}T05:00:00.000Z`,
    listing_timezone: 'America/Toronto',
    rental_location_listing: {
      id: 'listing-godox',
      business_location: { name: 'Atelier Nord', address: { city: 'Toronto', country: 'CA' } },
      rental_item: { name: 'Godox lighting kit', currency: 'CAD', business: { name: 'Atelier Nord' } },
    },
  };
}
