import { CATEGORIES, landingRows, searchRows, type CaptureListing } from './fixtures';

export function captureScene(): string {
  if (typeof window === 'undefined') return 'douala';
  return new URLSearchParams(window.location.search).get('scene') || 'douala';
}

function wash(from: string, to: string): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const gradient = ctx.createLinearGradient(0, 0, 96, 96);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  return canvas.toDataURL('image/png');
}

const WASH: Record<string, [string, string]> = {
  cameras: ['#16325c', '#2f6fed'],
  sound: ['#c2410c', '#f97316'],
  tools: ['#047857', '#34d399'],
};

function withPhotos(rows: CaptureListing[]): CaptureListing[] {
  return rows.map((row) => {
    const category = row.listing.rental_item.rental_category.name;
    const colors = WASH[category] ?? ['#1d4ed8', '#38bdf8'];
    const image = wash(colors[0], colors[1]);
    if (!image) return row;
    return {
      ...row,
      listing: {
        ...row.listing,
        rental_item: {
          ...row.listing.rental_item,
          rental_item_images: [{ id: `${row.listing.id}-img`, image_url: image }],
        },
      },
    };
  });
}

export function searchBody(params?: { q?: string; country_code?: string }): {
  success: boolean;
  data: { listings: CaptureListing[]; total: number; page: number; limit: number; availableCount: number; dates: null };
} {
  const scene = captureScene();
  const query = params?.q?.trim();
  const toronto = scene === 'toronto' || params?.country_code === 'CA';
  const rows = scene === 'empty'
    ? []
    : query
      ? withPhotos(searchRows())
      : withPhotos(landingRows(toronto ? 'CAD' : 'XAF', toronto ? 'Toronto' : 'Douala', toronto));
  return {
    success: true,
    data: {
      listings: rows,
      total: rows.length,
      page: 1,
      limit: 20,
      availableCount: rows.length,
      dates: null,
    },
  };
}

export function categoryBody() {
  return { success: true, data: { categories: CATEGORIES } };
}

export function shouldHang(): boolean {
  return captureScene() === 'loading';
}
