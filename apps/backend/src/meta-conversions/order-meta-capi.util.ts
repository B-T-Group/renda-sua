import type { MetaActionSource } from './meta-conversions.types';

export type OrderMetaCapiContext = {
  fbc?: string;
  fbp?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  actionSource?: MetaActionSource;
  eventSourceUrl?: string;
};

export type MetaGeoAddress = {
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

function trimOrUndef(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function buildOrderMetaCapiContext(
  input: OrderMetaCapiContext
): OrderMetaCapiContext | null {
  const out: OrderMetaCapiContext = {};
  const fbc = trimOrUndef(input.fbc);
  const fbp = trimOrUndef(input.fbp);
  const ip = trimOrUndef(input.clientIpAddress);
  const ua = trimOrUndef(input.clientUserAgent);
  const url = trimOrUndef(input.eventSourceUrl);
  if (fbc) out.fbc = fbc;
  if (fbp) out.fbp = fbp;
  if (ip) out.clientIpAddress = ip;
  if (ua) out.clientUserAgent = ua;
  if (input.actionSource) out.actionSource = input.actionSource;
  if (url) out.eventSourceUrl = url;
  return Object.keys(out).length > 0 ? out : null;
}

export function parseOrderMetaCapiContext(raw: unknown): OrderMetaCapiContext {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return buildOrderMetaCapiContext({
    fbc: typeof o.fbc === 'string' ? o.fbc : undefined,
    fbp: typeof o.fbp === 'string' ? o.fbp : undefined,
    clientIpAddress:
      typeof o.clientIpAddress === 'string' ? o.clientIpAddress : undefined,
    clientUserAgent:
      typeof o.clientUserAgent === 'string' ? o.clientUserAgent : undefined,
    actionSource: parseActionSource(o.actionSource),
    eventSourceUrl:
      typeof o.eventSourceUrl === 'string' ? o.eventSourceUrl : undefined,
  }) ?? {};
}

function parseActionSource(value: unknown): MetaActionSource | undefined {
  if (value === 'website' || value === 'app' || value === 'other') return value;
  return undefined;
}

export function pickMetaGeoAddress(
  delivery?: MetaGeoAddress | null,
  location?: MetaGeoAddress | null
): MetaGeoAddress {
  if (delivery?.city || delivery?.postal_code || delivery?.country) {
    return delivery;
  }
  return location ?? {};
}
