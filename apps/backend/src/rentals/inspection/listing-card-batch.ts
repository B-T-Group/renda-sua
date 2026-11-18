import { resolveItemCountry } from '../../mobile-payments/item-country.util';
import type { ListingCardWindow } from '../rental-card-window';
import { listingWindowInspected } from './inspection-optin';

export interface CardListing {
  rental_item?: { id?: string | null } | null;
  business_location?: { address?: { country?: string | null } | null } | null;
}

export interface CardWindowDeps {
  optInEnabled(country: string | null): Promise<boolean>;
  stampsForItems(ids: string[]): Promise<Map<string, boolean>>;
  forCountry(country: string | null, inspected?: boolean): Promise<ListingCardWindow>;
}

export function listingIso(raw?: string | null): string | null {
  return resolveItemCountry(raw);
}

export async function attachListingCardWindows<T extends CardListing>(
  rows: T[],
  deps: CardWindowDeps
): Promise<Array<T & ListingCardWindow>> {
  if (!rows.length) return [];
  const inspected = await inspectedByItem(rows, deps);
  const windows = await windowsFor(rows, inspected, deps.forCountry);
  return rows.map((row) => withWindow(row, windows, inspected));
}

export async function inspectedByItem(
  rows: CardListing[],
  deps: Pick<CardWindowDeps, 'optInEnabled' | 'stampsForItems'>
): Promise<Map<string, boolean | undefined>> {
  const flags = await flagsFor(rows, deps.optInEnabled);
  const ids = stampIds(rows, flags);
  const stamps = ids.length ? await deps.stampsForItems(ids) : new Map<string, boolean>();
  return applyStamps(rows, flags, stamps);
}

function countryOf(row: CardListing): string {
  return listingIso(row.business_location?.address?.country) ?? '';
}

async function flagsFor(rows: CardListing[], optIn: CardWindowDeps['optInEnabled']) {
  const flags = new Map<string, boolean>();
  for (const code of new Set(rows.map(countryOf))) {
    flags.set(code, await optIn(code || null));
  }
  return flags;
}

function stampIds(rows: CardListing[], flags: Map<string, boolean>): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    const id = row.rental_item?.id;
    if (id && flags.get(countryOf(row))) ids.add(id);
  }
  return [...ids];
}

function applyStamps(
  rows: CardListing[],
  flags: Map<string, boolean>,
  stamps: Map<string, boolean>
): Map<string, boolean | undefined> {
  const out = new Map<string, boolean | undefined>();
  for (const row of rows) {
    const id = row.rental_item?.id;
    if (!id || out.has(id)) continue;
    const on = flags.get(countryOf(row)) === true;
    out.set(id, listingWindowInspected(on, stamps.get(id) === true));
  }
  return out;
}

async function windowsFor(
  rows: CardListing[],
  inspected: Map<string, boolean | undefined>,
  forCountry: CardWindowDeps['forCountry']
) {
  const cache = new Map<string, ListingCardWindow>();
  for (const row of rows) {
    const key = windowKey(row, inspected);
    if (cache.has(key)) continue;
    cache.set(key, await loadWindow(row, inspected, forCountry));
  }
  return cache;
}

async function loadWindow(
  row: CardListing,
  inspected: Map<string, boolean | undefined>,
  forCountry: CardWindowDeps['forCountry']
) {
  const id = row.rental_item?.id;
  return forCountry(countryOf(row) || null, id ? inspected.get(id) : undefined);
}

function withWindow<T extends CardListing>(
  row: T,
  windows: Map<string, ListingCardWindow>,
  inspected: Map<string, boolean | undefined>
): T & ListingCardWindow {
  return { ...row, ...windows.get(windowKey(row, inspected))! };
}

function windowKey(row: CardListing, inspected: Map<string, boolean | undefined>): string {
  const id = row.rental_item?.id;
  const flag = id ? inspected.get(id) : undefined;
  const mark = flag === undefined ? 'country' : flag ? 'yes' : 'no';
  return `${countryOf(row)}|${mark}`;
}
