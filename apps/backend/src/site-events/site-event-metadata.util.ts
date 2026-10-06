import { Logger } from '@nestjs/common';

const AUTH_METADATA_ALLOWLIST = new Set([
  'entry',
  'step',
  'channel',
  'is_resend',
  'is_channel_switch',
  'reason',
  'attempt_n',
  'attempts',
  'is_new_account',
  'ms_since_gate_shown',
  'result',
  'fail_reason',
  'action',
  'context',
  'platform',
  'flag_on',
  'auth_path',
  'legacy_auth0_session_present',
  'source',
  'contactMethod',
  'screenHint',
]);

// Server event keys that should not be filtered despite containing digits (Phase 0 #453)
const SERVER_EVENT_ID_ALLOWLIST = new Set([
  'orderId',
  'orderNumber',
  'agentId',
  'transactionId',
  'mobilePaymentTransactionId',
  'businessId',
  'businessLocationId',
  'clientId',
]);

const SENSITIVE_VALUE_KEY = /^(code|otp|password|loginhint|login_hint|email|phone|phone_number)$/i;

const logger = new Logger('SiteEventMetadata');

export function isAuthSiteEventType(eventType: string): boolean {
  return eventType.startsWith('auth_');
}

export function filterAuthEventMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (AUTH_METADATA_ALLOWLIST.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function looksLikeEmail(value: string): boolean {
  const s = value.trim();
  if (!s.includes('@')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

export function looksLikePhone(value: string): boolean {
  return digitsOnly(value).length >= 7;
}

function looksLikeShortCode(value: string): boolean {
  const s = value.trim();
  return /^\d{4,8}$/.test(s);
}

export function valueLooksLikePii(
  key: string,
  value: unknown,
  isServerEvent: boolean
): boolean {
  if (typeof value !== 'string') return false;
  if (SENSITIVE_VALUE_KEY.test(key)) return true;
  // For server events, allow specific ID keys even if they contain digits
  if (isServerEvent && SERVER_EVENT_ID_ALLOWLIST.has(key)) return false;
  if (looksLikeEmail(value)) return true;
  if (looksLikePhone(value)) return true;
  if (looksLikeShortCode(value)) return true;
  return false;
}

export function stripPiiFromMetadata(
  metadata: Record<string, unknown>,
  isServerEvent: boolean
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (valueLooksLikePii(key, value, isServerEvent)) {
      logger.warn(`Dropping PII-like key "${key}" from site_event metadata`);
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = stripPiiFromMetadata(value as Record<string, unknown>, isServerEvent);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function normalizeSiteEventMetadata(
  eventType: string,
  metadata: Record<string, unknown> | undefined,
  viewerType: string
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {};
  const isServerEvent = viewerType === 'server';
  const base = isAuthSiteEventType(eventType)
    ? filterAuthEventMetadata(metadata)
    : { ...metadata };
  return stripPiiFromMetadata(base, isServerEvent);
}
