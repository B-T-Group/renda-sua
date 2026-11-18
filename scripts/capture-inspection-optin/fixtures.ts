/** Fixture JSON for the inspection opt-in capture harness. Scene comes from the page query. */

export function sceneName(): string {
  if (typeof window === 'undefined') return 'edit';
  return new URLSearchParams(window.location.search).get('scene') ?? 'edit';
}

export function heroUrl(): string {
  return `${window.location.origin}/hero.png`;
}

function hours() {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    is_available: weekday !== 0,
    start_time: weekday === 0 ? null : '08:00',
    end_time: weekday === 0 ? null : '20:00',
  }));
}

function item(scene: string) {
  const baseline = scene === 'baseline';
  return {
    id: 'item-1',
    name: 'JBL PartyBox 310',
    description: 'Portable party speaker with lights and a microphone.',
    rental_category_id: 'cat-audio',
    currency: 'CAD',
    tags: ['speaker', 'party'],
    is_active: true,
    operation_mode: 'business_operated',
    rental_item_images: [{ id: 'img-1', image_url: heroUrl(), display_order: 0 }],
    inspection: {
      enabled: false,
      rail: scene === 'explainer-momo' ? 'momo' : 'card',
      baselineComplete: false,
      photos: baseline ? [{ id: 'base-1', slotKey: 'overview', status: 'ready' }] : [],
    },
    rental_location_listings: [
      {
        id: 'list-1',
        business_location_id: 'loc-1',
        base_price_per_hour: 15,
        base_price_per_day: 45,
        security_deposit_amount: 20,
        min_rental_hours: 1,
        max_rental_hours: null,
        units_available: 2,
        is_active: true,
        moderation_status: 'approved',
        pickup_instructions: 'Ask at the counter.',
        dropoff_instructions: 'Return to the counter.',
        weekly_availability: hours(),
        business_location: { id: 'loc-1', name: 'Atelier Nord, Toronto' },
      },
    ],
  };
}

export function booking(scene = sceneName()) {
  return {
    id: 'b1',
    status: 'reserved',
    inspection_policy_version: 1,
    currency: 'CAD',
    payment_status: 'authorized',
    security_deposit_amount: 20,
    authorized_amount: 65,
    total_amount: 65,
    end_at: '2026-11-15T18:00:00Z',
    units_booked: 1,
    rental_location_listing: {
      rental_item: { name: 'JBL PartyBox 310', rental_item_images: [{ id: 'img-1', image_url: heroUrl() }] },
      business_location: { name: 'Atelier Nord, Toronto', address: { country: 'CA' } },
    },
    accept_start_preview: { payment_rail: 'card' as const, amount_due_at_pickup: 65 },
    client: { user: { first_name: 'Amina' } },
  };
}

function photos() {
  const hero = heroUrl();
  return [
    { id: 'p1', role: 'overview', url: hero, capturedAt: '2026-11-14T15:14:00Z', reused: false, captureSource: 'camera' },
    { id: 'p2', role: 'other_side', url: hero, capturedAt: '2026-11-02T16:40:00Z', reused: true, captureSource: 'gallery' },
    { id: 'p3', role: 'accessories', url: hero, capturedAt: '2026-11-02T16:40:00Z', reused: true, captureSource: 'gallery' },
  ];
}

function inspectionView(scene: string, stage: 'pickup' | 'return') {
  if (stage === 'return') {
    return { status: 'draft', submittedAt: null, yourDecision: null, versionId: null, minPhotos: 3, units: [] };
  }
  const review = scene === 'review';
  return {
    status: review ? 'submitted' : 'draft',
    submittedAt: review ? '2026-11-14T16:00:00Z' : null,
    yourDecision: null,
    versionId: review ? 'ver-1' : null,
    versionNo: review ? 1 : null,
    minPhotos: 3,
    units: [
      {
        unitId: 'u1',
        slotIndex: 0,
        displayLabel: 'Unit 1',
        physicalLabel: null,
        condition: 'good',
        accessories: [{ name: 'Microphone', count: 1 }],
        wear: 'none',
        photos: photos(),
      },
    ],
  };
}

function rules(scene: string) {
  const damage = scene === 'damage';
  return {
    enabled: true,
    optIn: true,
    beforeStart: true,
    webUpload: true,
    pickupDay: true,
    timezone: 'America/Toronto',
    startAt: '2026-11-14T15:00:00Z',
    guideMode: null,
    guide: null,
    reuse: damage
      ? { available: false, blocked: true, reason: 'damage', source: 'return', submittedAt: '2026-11-02T16:40:00Z', photoCount: 2 }
      : { available: true, blocked: false, source: 'return', submittedAt: '2026-11-02T16:40:00Z', photoCount: 2 },
  };
}

function inspectionBody(path: string, scene: string) {
  if (path.includes('photo-rules')) return rules(scene);
  if (path.includes('/evidence/')) return { url: heroUrl(), expiresAt: '2026-11-15T00:00:00Z' };
  if (path.endsWith('/return')) return inspectionView(scene, 'return');
  if (path.endsWith('/pickup')) return inspectionView(scene, 'pickup');
  return { success: true };
}

function flags() {
  return {
    success: true,
    data: {
      rentals_inspection_optin_enabled: true,
      rentals_inspection_confirmations_enabled: false,
      rentals_pickup_photo_rules_enabled: false,
    },
  };
}

export function bodyFor(url: string, _method = 'GET', scene = sceneName()) {
  const path = url.split('?')[0];
  if (path.includes('client-flags')) return flags();
  if (path.includes('supported-countries')) {
    return {
      success: true,
      countries: [{ code: 'CA', name: 'Canada', currencyCode: 'CAD', serviceStatus: 'active', deliveryEnabled: true, supportedPaymentMethods: ['card'] }],
    };
  }
  if (path.includes('/business-items/locations')) {
    return { success: true, data: { primary_address_country: 'CA', locations: [] } };
  }
  if (path.includes('/rentals/categories')) {
    return { success: true, data: { categories: [{ id: 'cat-audio', name: 'Audio', slug: 'audio' }] } };
  }
  if (path.includes('/inspections/')) return inspectionBody(path, scene);
  if (/\/rentals\/bookings\/[^/]+$/.test(path)) return { success: true, data: { booking: booking(scene) } };
  if (path.includes('/rentals/business/items/')) return { success: true, data: { item: item(scene) } };
  return { success: true };
}
