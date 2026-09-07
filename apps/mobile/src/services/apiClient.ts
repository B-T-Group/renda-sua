/**
 * Client API REST Rendasua Agent – NestJS backend.
 * Bearer token depuis auth0DirectService (refresh si expiré).
 */

import { Platform } from 'react-native';
import { getEnv } from '../config/auth0';
import Auth0DirectService from './auth0DirectService';
import { buildActivePersonaHeaders } from '../utils/activePersonaStorage';

const baseUrl = () => getEnv().apiUrl ?? 'https://prod.api.rendasua.com/api';

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await Auth0DirectService.getAccessToken();
  const personaHeaders = await buildActivePersonaHeaders();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...personaHeaders,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    (headers as Record<string, string>)['x-rendasua-platform'] = Platform.OS;
  }
  return headers;
}

function nestMessageToString(message: unknown): string | undefined {
  if (typeof message === 'string') {
    const t = message.trim();
    return t || undefined;
  }
  if (!Array.isArray(message)) return undefined;
  const parts = message
    .map((m) =>
      typeof m === 'string'
        ? m
        : typeof m === 'object' && m !== null && 'constraints' in m
          ? Object.values((m as { constraints: Record<string, string> }).constraints).join(', ')
          : ''
    )
    .filter(Boolean);
  return parts.length ? parts.join('. ') : undefined;
}

/** Best-effort user-facing text from Nest / JSON error bodies (single response read). */
function extractApiErrorBody(text: string): { message?: string; code?: string } {
  if (!text?.trim()) return {};
  try {
    const parsed = JSON.parse(text) as {
      message?: unknown;
      error?: unknown;
      code?: string;
      data?: { error?: unknown; message?: unknown; code?: string };
    };
    // Business error codes use SCREAMING_SNAKE_CASE (e.g. MERCHANT_CLOSED).
    // Standard NestJS `error` strings are HTTP status text ("Bad Request") — not codes.
    const codeFromError =
      typeof parsed.error === 'string' && /^[A-Z][A-Z0-9_]+$/.test(parsed.error)
        ? parsed.error
        : undefined;
    const code = parsed.code || codeFromError;
    if (parsed.message && typeof parsed.message === 'object' && parsed.message !== null) {
      const nested = parsed.message as { error?: unknown; message?: unknown };
      const fromNested = nestMessageToString(nested.error ?? nested.message);
      if (fromNested) return { message: fromNested, code };
    }
    const top = nestMessageToString(parsed.message);
    if (top) return { message: top, code };
    if (parsed.data && typeof parsed.data === 'object') {
      const d = parsed.data;
      const fromData = nestMessageToString(d.error ?? d.message);
      if (fromData) return { message: fromData, code: d.code || code };
    }
    const fromError =
      typeof parsed.error === 'string'
        ? parsed.error
        : nestMessageToString(parsed.error);
    return { message: fromError, code };
  } catch {
    return {};
  }
}

async function doFetch(
  url: string,
  options: RequestInit,
  headerOverrides?: Record<string, string>
): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(url, {
    ...options,
    headers: {
      ...(headers as Record<string, string>),
      ...(options.headers as Record<string, string>),
      ...(headerOverrides ?? {}),
    },
  });
}

export function resolveApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http')) return endpoint;
  return `${baseUrl()}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}

function throwApiError(status: number, statusText: string, text: string): never {
  const errorBody = extractApiErrorBody(text);
  const errorMessage = errorBody.message ?? `API ${status}: ${statusText}`;
  const error = new Error(errorMessage) as Error & { code?: string; status?: number };
  error.code = errorBody.code;
  error.status = status;
  throw error;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  headerOverrides?: Record<string, string>,
  /** Internal: prevents infinite retry loops if the refreshed token still 401s. */
  _retriedAfterRefresh = false
): Promise<T> {
  const url = resolveApiUrl(endpoint);
  const res = await doFetch(url, options, headerOverrides);

  if ((res.status === 401 || res.status === 403) && !_retriedAfterRefresh) {
    const result = await Auth0DirectService.refreshAccessTokenDetailed();
    if (result.ok) {
      // Refresh succeeded — retry the original request once with the new
      // token instead of surfacing the 401 to the caller.
      return apiRequest<T>(endpoint, options, headerOverrides, true);
    }
  }

  const text = await res.text();
  if (!res.ok) throwApiError(res.status, res.statusText, text);
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiRequestBlob(
  endpoint: string,
  options: RequestInit = {},
  _retriedAfterRefresh = false
): Promise<{ blob: Blob; mimeType: string }> {
  const res = await doFetch(resolveApiUrl(endpoint), options);
  if ((res.status === 401 || res.status === 403) && !_retriedAfterRefresh) {
    const result = await Auth0DirectService.refreshAccessTokenDetailed();
    if (result.ok) return apiRequestBlob(endpoint, options, true);
  }
  if (!res.ok) throwApiError(res.status, res.statusText, await res.text());
  const mimeType = res.headers.get('content-type') || 'application/octet-stream';
  return { blob: await res.blob(), mimeType };
}

export const api = {
  get: <T = unknown>(endpoint: string, headerOverrides?: Record<string, string>) =>
    apiRequest<T>(endpoint, { method: 'GET' }, headerOverrides),
  post: <T = unknown>(
    endpoint: string,
    body?: unknown,
    init?: RequestInit,
    headerOverrides?: Record<string, string>
  ) =>
    apiRequest<T>(
      endpoint,
      {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
        ...init,
      },
      headerOverrides
    ),
  put: <T = unknown>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = unknown>(endpoint: string) => apiRequest<T>(endpoint, { method: 'DELETE' }),
};
