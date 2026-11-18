/** Fixture catalog rows for the rentals default-list captures. Not imported by the apps. */

export interface CaptureListing {
  listing: {
    id: string;
    base_price_per_hour: number;
    base_price_per_day: number;
    min_rental_hours: number;
    max_rental_hours: null;
    pickup_instructions: string;
    dropoff_instructions: string;
    weekly_availability: [];
    rental_item: {
      id: string;
      name: string;
      description: string;
      tags: string[];
      currency: string;
      operation_mode: string;
      rental_category: { id: string; name: string };
      rental_item_images: Array<{ id: string; image_url: string }>;
      business: { id: string; name: string };
    };
    business_location: {
      id: string;
      name: string;
      address: { city: string };
    };
  };
  available: boolean | null;
  nextAvailableDate: string | null;
  pricePerDay: number;
  totalForDates: number | null;
  dayCount: number | null;
  inspection_enabled: boolean;
}

export const CATEGORIES = [
  { id: 'cameras', name: 'cameras', bookingCount: 4, listingCount: 4 },
  { id: 'tools', name: 'tools', bookingCount: 3, listingCount: 3 },
  { id: 'sound', name: 'sound', bookingCount: 2, listingCount: 2 },
  { id: 'events', name: 'events', bookingCount: 2, listingCount: 2 },
  { id: 'vehicles', name: 'vehicles', bookingCount: 1, listingCount: 1 },
];

type RowInput = {
  id: string;
  name: string;
  business: string;
  city: string;
  price: number;
  currency: string;
  category: string;
  inspection?: boolean;
  available?: boolean | null;
  nextAvailableDate?: string | null;
  totalForDates?: number | null;
  dayCount?: number | null;
  image?: string;
};

export function captureRow(input: RowInput): CaptureListing {
  return {
    listing: {
      id: input.id,
      base_price_per_hour: 0,
      base_price_per_day: input.price,
      min_rental_hours: 24,
      max_rental_hours: null,
      pickup_instructions: '',
      dropoff_instructions: '',
      weekly_availability: [],
      rental_item: {
        id: `${input.id}-item`,
        name: input.name,
        description: '',
        tags: [],
        currency: input.currency,
        operation_mode: 'business_operated',
        rental_category: { id: input.category, name: input.category },
        rental_item_images: input.image ? [{ id: `${input.id}-img`, image_url: input.image }] : [],
        business: { id: `${input.id}-biz`, name: input.business },
      },
      business_location: {
        id: `${input.id}-loc`,
        name: input.business,
        address: { city: input.city },
      },
    },
    available: input.available ?? null,
    nextAvailableDate: input.nextAvailableDate ?? null,
    pricePerDay: input.price,
    totalForDates: input.totalForDates ?? null,
    dayCount: input.dayCount ?? null,
    inspection_enabled: input.inspection === true,
  };
}

export function landingRows(currency: string, city: string, toronto: boolean): CaptureListing[] {
  const rows = toronto ? torontoLanding(city, currency) : doualaLanding(city, currency);
  return rows;
}

function doualaLanding(city: string, currency: string): CaptureListing[] {
  return [
    captureRow({ id: 'sony', name: 'Sony A7 IV kit', business: 'Studio Akwa', city, price: 45000, currency, category: 'cameras', inspection: true }),
    captureRow({ id: 'jbl', name: 'JBL PartyBox 310', business: 'Sono Bonanjo', city, price: 18000, currency, category: 'sound' }),
    captureRow({ id: 'makita', name: 'Kit Makita 18V', business: 'Atelier Deido', city, price: 8000, currency, category: 'tools' }),
    captureRow({ id: 'dji', name: 'DJI Mini 4 Pro', business: 'SkyCam Douala', city, price: 32000, currency, category: 'cameras', inspection: true }),
    captureRow({ id: 'canon', name: 'Canon EOS R6', business: 'Lumière Studio', city, price: 38000, currency, category: 'cameras', inspection: true }),
    captureRow({ id: 'shure', name: 'Shure SM58', business: 'Sono Bonanjo', city, price: 6000, currency, category: 'sound' }),
    captureRow({ id: 'bosch', name: 'Perceuse Bosch', business: 'Atelier Deido', city, price: 5000, currency, category: 'tools' }),
    captureRow({ id: 'tent', name: 'Tente 3x3', business: 'Eventis Akwa', city, price: 15000, currency, category: 'events' }),
    captureRow({ id: 'prado', name: 'Toyota Prado', business: 'Location Wouri', city, price: 75000, currency, category: 'vehicles', inspection: true }),
    captureRow({ id: 'godox', name: 'Godox SL60', business: 'Studio Akwa', city, price: 22000, currency, category: 'cameras' }),
    captureRow({ id: 'yamaha', name: 'Yamaha DXR10', business: 'Sono Bonanjo', city, price: 12000, currency, category: 'sound' }),
    captureRow({ id: 'scaffold', name: 'Échafaudage', business: 'Atelier Deido', city, price: 9000, currency, category: 'tools' }),
  ];
}

function torontoLanding(city: string, currency: string): CaptureListing[] {
  return [
    captureRow({ id: 'sony', name: 'Sony A7 IV kit', business: 'Harbour Studio', city, price: 85, currency, category: 'cameras', inspection: true }),
    captureRow({ id: 'jbl', name: 'JBL PartyBox 310', business: 'Parkdale Sound', city, price: 45, currency, category: 'sound' }),
    captureRow({ id: 'dewalt', name: 'DeWalt 20V kit', business: 'Queen West Tools', city, price: 28, currency, category: 'tools' }),
    captureRow({ id: 'dji', name: 'DJI Mini 4 Pro', business: 'North York Aerial', city, price: 120, currency, category: 'cameras', inspection: true }),
    captureRow({ id: 'canon', name: 'Canon EOS R6', business: 'Lumière Studio', city, price: 70, currency, category: 'cameras', inspection: true }),
    captureRow({ id: 'shure', name: 'Shure SM58', business: 'Parkdale Sound', city, price: 18, currency, category: 'sound' }),
    captureRow({ id: 'bosch', name: 'Bosch drill', business: 'Queen West Tools', city, price: 15, currency, category: 'tools' }),
    captureRow({ id: 'tent', name: 'Tent 3x3', business: 'King West Events', city, price: 40, currency, category: 'events' }),
    captureRow({ id: 'rav4', name: 'Toyota RAV4', business: 'Midtown Cars', city, price: 95, currency, category: 'vehicles', inspection: true }),
    captureRow({ id: 'godox', name: 'Godox SL60', business: 'Harbour Studio', city, price: 55, currency, category: 'cameras' }),
    captureRow({ id: 'yamaha', name: 'Yamaha DXR10', business: 'Parkdale Sound', city, price: 32, currency, category: 'sound' }),
    captureRow({ id: 'scaffold', name: 'Scaffold tower', business: 'Queen West Tools', city, price: 22, currency, category: 'tools' }),
  ];
}

export function searchRows(): CaptureListing[] {
  return [
    captureRow({
      id: 'sony', name: 'Sony A7 IV kit', business: 'Studio Akwa', city: 'Douala', price: 45000, currency: 'XAF',
      category: 'cameras', inspection: true, available: true, totalForDates: 135000, dayCount: 3,
    }),
    captureRow({
      id: 'canon', name: 'Canon EOS R6', business: 'Lumière Studio', city: 'Douala', price: 38000, currency: 'XAF',
      category: 'cameras', inspection: true, available: true, totalForDates: 114000, dayCount: 3,
    }),
    captureRow({
      id: 'dji', name: 'DJI Mini 4 Pro', business: 'SkyCam Douala', city: 'Douala', price: 32000, currency: 'XAF',
      category: 'cameras', inspection: true, available: false, nextAvailableDate: '2026-11-28', dayCount: 3,
    }),
  ];
}
