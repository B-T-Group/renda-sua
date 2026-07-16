/** Deterministic store avatar palette from a business name. */

export type StoreAvatarPalette = {
  bg: string;
  bgSoft: string;
  accent: string;
  accentSoft: string;
  monogram: string;
};

const PALETTES: StoreAvatarPalette[] = [
  {
    bg: '#1B6B93',
    bgSoft: '#E8F4F8',
    accent: '#F4A261',
    accentSoft: '#FFE8D1',
    monogram: '#FFFFFF',
  },
  {
    bg: '#2A9D8F',
    bgSoft: '#E6F6F4',
    accent: '#E76F51',
    accentSoft: '#FDE8E3',
    monogram: '#FFFFFF',
  },
  {
    bg: '#264653',
    bgSoft: '#E8EEF0',
    accent: '#E9C46A',
    accentSoft: '#FBF3D9',
    monogram: '#FFFFFF',
  },
  {
    bg: '#6A4C93',
    bgSoft: '#F0EAF6',
    accent: '#1982C4',
    accentSoft: '#DCEFF9',
    monogram: '#FFFFFF',
  },
  {
    bg: '#C1121F',
    bgSoft: '#F9E8E9',
    accent: '#023E8A',
    accentSoft: '#DCE8F5',
    monogram: '#FFFFFF',
  },
  {
    bg: '#0077B6',
    bgSoft: '#E5F3FA',
    accent: '#F77F00',
    accentSoft: '#FFE8CC',
    monogram: '#FFFFFF',
  },
  {
    bg: '#40916C',
    bgSoft: '#E8F5EF',
    accent: '#BC4749',
    accentSoft: '#F8E6E6',
    monogram: '#FFFFFF',
  },
  {
    bg: '#9B2226',
    bgSoft: '#F6E8E9',
    accent: '#0A9396',
    accentSoft: '#D9F2F2',
    monogram: '#FFFFFF',
  },
];

export function hashStoreName(name: string): number {
  let h = 0;
  const s = name.trim().toLowerCase() || 'store';
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function storeAvatarPalette(name: string): StoreAvatarPalette {
  return PALETTES[hashStoreName(name) % PALETTES.length];
}

export function storeMonogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'S';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return trimmed.slice(0, 1).toUpperCase();
}
