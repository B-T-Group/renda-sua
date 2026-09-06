/**
 * Unauthenticated REST calls to the Rendasua Nest API (e.g. public catalog).
 * Avoids Auth0 refresh logic from {@link apiClient} on unexpected 401s.
 */

import { getEnv } from '../config/auth0';

function baseUrl(): string {
  return getEnv().apiUrl ?? 'https://prod.api.rendasua.com/api';
}

function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const path = endpoint.startsWith('http')
    ? endpoint
    : `${baseUrl()}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    search.set(k, String(v));
  }
  const q = search.toString();
  return q ? `${path}?${q}` : path;
}

export async function publicApiGet<T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
  init?: { signal?: AbortSignal }
): Promise<T> {
  const url = buildUrl(endpoint, params);
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    signal: init?.signal,
  });
  const text = await res.text();
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = text ? (JSON.parse(text) as { message?: string }) : null;
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function publicApiPost<T>(
  endpoint: string,
  body: unknown,
  init?: { signal?: AbortSignal; headers?: Record<string, string> }
): Promise<T> {
  const url = buildUrl(endpoint);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body ?? {}),
    signal: init?.signal,
  });
  const text = await res.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }
  if (!res.ok) {
    const o = parsed as { message?: string; error?: string };
    const message = o?.error || o?.message || res.statusText || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return parsed as T;
}
