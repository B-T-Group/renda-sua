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

// Assistant metadata validators (Phase 0 #451 PR review): per-key validation
const ASSISTANT_ENUM_VALUES = {
  input: new Set(['typed', 'chip', 'voice']),
  intent: new Set(['buy', 'availability', 'reorder', 'track', 'support', 'other']),
  confidence: new Set(['high', 'low']),
  rating: new Set(['up', 'down']),
  reason: new Set(['wrong_price', 'wrong_stock', 'off_topic', 'other']),
  kind: new Set(['network', 'server', 'rate_limited']),
  entry: new Set(['orb', 'header_icon', 'menu', 'nudge', 'orb_extended']),
  variant: new Set(['orb', 'orb_extended', 'header_icon']),
  motion: new Set(['on', 'reduced']),
  dismiss_reason: new Set(['close', 'outside', 'timeout', 'opened']),
  trigger: new Set(['first_run', 'zero_results', 'reorder_eligible', 'chip', 'model', 'low_confidence']),
  context: new Set(['empty_state', 'in_thread']),
  type: new Set(['item', 'store', 'cart', 'reorder', 'order', 'search']),
  via: new Set(['reorder', 'item', 'store']),
  card_type: new Set(['item', 'store', 'order', 'reorder', 'link']),
  length_bucket: new Set(['<20', '20-80', '>80']),
  // Gate fields (spec §4, plan §3.3)
  persona: new Set(['guest', 'client', 'agent', 'business', 'delegate', 'admin']),
  channel: new Set(['app', 'whatsapp']),
  // ISO-2 country codes for market (common markets from the repo)
  market: new Set(['CM', 'GA', 'CA', 'US', 'TG', 'BJ', 'CI', 'CG', 'PH']),
  locale: new Set(['en', 'fr']),
  // Feedback fields (plan §4 AC13)
  currency: new Set(['XAF', 'XOF', 'FCFA', 'CAD', 'USD', 'PHP']),
  shown_stock_bucket: new Set(['in', 'low', 'out']),
};

const ASSISTANT_TOOL_NAMES = new Set([
  'get_knowledge',
  'list_supported_country_states',
  'list_supported_payment_systems',
  'request_human_support',
  'get_my_profile_summary',
  'get_my_recent_orders',
  'get_order_status',
  'get_my_addresses',
  'search_catalog',
  'get_reorder_options',
]);

const SCREEN_CHIP_PATTERN = /^[A-Za-z0-9_.-]{1,40}$/;

const MAX_SHOWN_PRICE = 99_999_999;

// Keys exempt from the phone heuristic only when the value is a strict UUID.
const ASSISTANT_UUID_ID_KEYS: ReadonlySet<string> = new Set(['thread_id', 'target_id', 'order_id']);
// Client reorder events (mobile sends metadata.orderId; web uses subject_id).
const REORDER_UUID_ID_KEYS: ReadonlySet<string> = new Set(['orderId']);
const NO_UUID_ID_KEYS: ReadonlySet<string> = new Set();

function validateAssistantValue(key: string, value: unknown): unknown | null {
  // UUID-validated fields
  if (ASSISTANT_UUID_ID_KEYS.has(key)) {
    if (typeof value === 'string' && isUuidValue(value)) {
      return value;
    }
    return null;
  }

  // Enum fields
  if (key in ASSISTANT_ENUM_VALUES) {
    const allowedSet = ASSISTANT_ENUM_VALUES[key as keyof typeof ASSISTANT_ENUM_VALUES];
    if (typeof value === 'string' && allowedSet.has(value)) {
      return value;
    }
    return null;
  }

  // Boolean fields
  if (['is_signed_in', 'has_active_order', 'reorder_eligible', 'grounded'].includes(key)) {
    if (typeof value === 'boolean') {
      return value;
    }
    return null;
  }

  // Bounded non-negative integers
  if (['turn', 'position', 'minutes_since_tap'].includes(key)) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 999999) {
      return value;
    }
    return null;
  }

  // Shown price: whole number, at most 8 digits. A 9+ digit integer could be
  // a phone number (CM mobiles are 9 digits), so it is dropped.
  if (key === 'shown_price') {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_SHOWN_PRICE) {
      return value;
    }
    return null;
  }

  // Screen and chip_id: alphanumeric with limited special chars
  if (['screen', 'chip_id'].includes(key)) {
    if (typeof value === 'string' && SCREEN_CHIP_PATTERN.test(value)) {
      return value;
    }
    return null;
  }

  // tools_used: array of known tool names, capped at 10 elements
  if (key === 'tools_used') {
    if (Array.isArray(value)) {
      const validated = value
        .filter((item) => typeof item === 'string' && ASSISTANT_TOOL_NAMES.has(item))
        .slice(0, 10);
      return validated.length > 0 ? validated : null;
    }
    return null;
  }

  // Reject nested objects outright
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return null;
  }

  // Reject any arrays not explicitly handled above
  if (Array.isArray(value)) {
    return null;
  }

  // Unknown key or invalid type
  return null;
}

const SENSITIVE_VALUE_KEY = /^(code|otp|password|loginhint|login_hint|email|phone|phone_number)$/i;

// UUID regex: 8-4-4-4-12 hex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const logger = new Logger('SiteEventMetadata');

export function isAuthSiteEventType(eventType: string): boolean {
  return eventType.startsWith('auth_');
}

export function isAssistantSiteEventType(eventType: string): boolean {
  return eventType.startsWith('assistant.');
}

export function isReorderSiteEventType(eventType: string): boolean {
  return eventType.startsWith('orders.reorder.');
}

/** Keys whose values are kept only if they are strict UUIDs (dropped otherwise). */
export function uuidIdKeysForEventType(eventType: string): ReadonlySet<string> {
  if (isAssistantSiteEventType(eventType)) return ASSISTANT_UUID_ID_KEYS;
  if (isReorderSiteEventType(eventType)) return REORDER_UUID_ID_KEYS;
  return NO_UUID_ID_KEYS;
}

function isUuidValue(value: string): boolean {
  return UUID_REGEX.test(value);
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

export function filterAssistantEventMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const validated = validateAssistantValue(key, value);
    if (validated !== null) {
      out[key] = validated;
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
  isServerEvent: boolean,
  uuidIdKeys: ReadonlySet<string> = NO_UUID_ID_KEYS
): boolean {
  if (typeof value !== 'string') return false;
  if (SENSITIVE_VALUE_KEY.test(key)) return true;
  // For server events, allow specific ID keys even if they contain digits
  if (isServerEvent && SERVER_EVENT_ID_ALLOWLIST.has(key)) return false;
  // Assistant thread_id/target_id/order_id and reorder orderId: keep only strict
  // UUIDs (they would otherwise fail the ≥7-digit phone heuristic); drop anything else.
  if (uuidIdKeys.has(key)) {
    return !isUuidValue(value);
  }
  if (looksLikeEmail(value)) return true;
  if (looksLikePhone(value)) return true;
  if (looksLikeShortCode(value)) return true;
  return false;
}

export function stripPiiFromMetadata(
  metadata: Record<string, unknown>,
  isServerEvent: boolean,
  uuidIdKeys: ReadonlySet<string> = NO_UUID_ID_KEYS
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (valueLooksLikePii(key, value, isServerEvent, uuidIdKeys)) {
      logger.warn(`Dropping PII-like key "${key}" from site_event metadata`);
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = stripPiiFromMetadata(value as Record<string, unknown>, isServerEvent, uuidIdKeys);
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
  const isAssistantEvent = isAssistantSiteEventType(eventType);
  let base: Record<string, unknown>;
  if (isAuthSiteEventType(eventType)) {
    base = filterAuthEventMetadata(metadata);
  } else if (isAssistantEvent) {
    base = filterAssistantEventMetadata(metadata);
  } else {
    base = { ...metadata };
  }
  return stripPiiFromMetadata(base, isServerEvent, uuidIdKeysForEventType(eventType));
}
