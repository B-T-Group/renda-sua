import { geoStateKey } from './geo-state.util';
import type { GeoScope } from './platform-permissions';

export interface MarketRow {
  countryCode: string;
  countryName: string;
  stateId?: string;
  stateName?: string;
  stateKey?: string;
}

export interface ResourceGeo {
  countryCode: string | null;
  stateName?: string | null;
}

type BoolExp = Record<string, unknown>;

export function resolveCountryCode(
  raw: string | null | undefined,
  markets: MarketRow[]
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  const byCode = markets.find((row) => row.countryCode.trim().toUpperCase() === upper);
  if (byCode) return byCode.countryCode.trim().toUpperCase();
  const byName = markets.find((row) => row.countryName.trim().toUpperCase() === upper);
  if (byName) return byName.countryCode.trim().toUpperCase();
  return upper.length === 2 ? upper : null;
}

export function scopeCovers(
  scope: GeoScope,
  geo: ResourceGeo,
  markets: MarketRow[]
): boolean {
  if (scope.all) return true;
  const code = resolveCountryCode(geo.countryCode, markets);
  if (!code || !scopeHasCountry(scope, code)) return false;
  if (scope.countries.includes(code)) return true;
  const key = geoStateKey(geo.stateName);
  if (!key) return false;
  return scope.states.some((state) => state.countryCode === code && state.stateKey === key);
}

function scopeHasCountry(scope: Extract<GeoScope, { all: false }>, code: string): boolean {
  if (scope.countries.includes(code)) return true;
  return scope.states.some((state) => state.countryCode === code);
}

export function addressGeoWhere(
  scope: GeoScope,
  markets: MarketRow[]
): BoolExp | null {
  if (scope.all) return null;
  const parts = [
    ...scope.countries.map((code) => countryExp(code, markets)),
    ...stateGroups(scope).map((group) => stateExp(group, markets)),
  ];
  if (!parts.length) return { id: { _is_null: true } };
  return parts.length === 1 ? parts[0] : { _or: parts };
}

export function orderGeoWhere(
  scope: GeoScope,
  markets: MarketRow[]
): BoolExp | null {
  const address = addressGeoWhere(scope, markets);
  if (!address) return null;
  const shopMissing = {
    _not: { business_location: { address: { country: { _is_null: false } } } },
  };
  return {
    _or: [
      { business_location: { address } },
      { _and: [shopMissing, { delivery_address: address }] },
    ],
  };
}

export function businessGeoWhere(
  scope: GeoScope,
  markets: MarketRow[]
): BoolExp | null {
  const address = addressGeoWhere(scope, markets);
  if (!address) return null;
  return { business_locations: { address } };
}

export function personaGeoWhere(
  scope: GeoScope,
  markets: MarketRow[],
  addressPaths: string[]
): BoolExp | null {
  const address = addressGeoWhere(scope, markets);
  if (!address || scope.all) return null;
  const parts: BoolExp[] = addressPaths.map((path) => ({ [path]: { address } }));
  if (scope.countries.length) {
    parts.push({ user: { country: { _in: scope.countries } } });
  }
  return parts.length === 1 ? parts[0] : { _or: parts };
}

export function creditGeoWhere(
  scope: GeoScope,
  markets: MarketRow[]
): BoolExp | null {
  const order = orderGeoWhere(scope, markets);
  if (!order || scope.all) return null;
  if (!scope.countries.length) return { order };
  return {
    _or: [
      { order },
      {
        _and: [
          { order_id: { _is_null: true } },
          { user: { country: { _in: scope.countries } } },
        ],
      },
    ],
  };
}

export function countryInScope(scope: GeoScope, countryCode: string): boolean {
  if (scope.all) return true;
  if (scope.countries.includes(countryCode)) return true;
  return scope.states.some((state) => state.countryCode === countryCode);
}

export function stateInScope(
  scope: GeoScope,
  countryCode: string,
  stateName?: string | null
): boolean {
  if (scope.all || scope.countries.includes(countryCode)) return true;
  const key = geoStateKey(stateName);
  if (!key) return false;
  return scope.states.some(
    (state) => state.countryCode === countryCode && state.stateKey === key
  );
}

export function andWhere(base: BoolExp, extra: BoolExp | null | undefined): BoolExp {
  if (!extra || !Object.keys(extra).length) return base;
  if (!Object.keys(base).length) return extra;
  return { _and: [base, extra] };
}

function countryExp(code: string, markets: MarketRow[]): BoolExp {
  return { _or: countryMatchers(code, markets).map((value) => ({ country: { _ilike: value } })) };
}

function stateExp(
  group: { code: string; keys: string[] },
  markets: MarketRow[]
): BoolExp {
  return { _and: [countryExp(group.code, markets), { state_key: { _in: group.keys } }] };
}

function countryMatchers(code: string, markets: MarketRow[]): string[] {
  const names = markets
    .filter((row) => row.countryCode.trim().toUpperCase() === code)
    .map((row) => row.countryName.trim())
    .filter((name) => name.length > 0);
  return Array.from(new Set([code, ...names]));
}

function stateGroups(scope: Extract<GeoScope, { all: false }>): Array<{ code: string; keys: string[] }> {
  const grouped = new Map<string, string[]>();
  for (const state of scope.states) {
    if (scope.countries.includes(state.countryCode)) continue;
    const keys = grouped.get(state.countryCode) ?? [];
    if (!keys.includes(state.stateKey)) keys.push(state.stateKey);
    grouped.set(state.countryCode, keys);
  }
  return Array.from(grouped.entries()).map(([code, keys]) => ({ code, keys }));
}
