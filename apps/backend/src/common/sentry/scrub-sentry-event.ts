import { redactSecrets } from '../../mobile-payments/sanitize-provider-error.util';

/**
 * Sentry scrubbing (beforeSend / beforeSendTransaction).
 *
 * The HTTP instrumentation attaches the incoming request body, headers and cookies to
 * events. Request bodies on webhook routes carry live provider secrets (MyPVit
 * /secret-refresh posts `secret_key`), and console breadcrumbs keep whatever was logged
 * earlier in the process. Nothing here may reach Sentry unredacted.
 */

const SENSITIVE_HEADER = /authorization|cookie|secret|token|api[-_]?key|key|signature|password/i;
const SENSITIVE_FIELD =
  /^(new_)?secret([-_]?key)?$|^x[-_]secret$|^api[-_]?key$|^app[-_]?key$|^secretkey$|^password$|^pass$|^token$|^access[-_]?token$|^refresh[-_]?token$|^authorization$|^cookie$|signature/i;
const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

/** Deep copy with secret-named fields replaced and every string run through redactSecrets. */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactSecrets(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[Truncated]';
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_FIELD.test(k) ? REDACTED : redactDeep(v, depth + 1);
  }
  return out;
}

function scrubHeaders(headers: unknown): Record<string, unknown> | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    out[k] = SENSITIVE_HEADER.test(k) ? REDACTED : redactSecrets(v);
  }
  return out;
}

type Breadcrumb = { message?: string; data?: unknown; [k: string]: unknown };
type ScrubbableEvent = {
  message?: unknown;
  logentry?: { message?: string; params?: unknown[] };
  request?: Record<string, unknown> & { headers?: unknown; data?: unknown };
  exception?: { values?: Array<{ value?: string; [k: string]: unknown }> };
  breadcrumbs?: Breadcrumb[];
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  spans?: Array<{ description?: string; data?: unknown; [k: string]: unknown }>;
  [k: string]: unknown;
};

/** Mutates and returns the event with request bodies, credentials and secrets removed. */
export function scrubSentryEvent<T>(event: T): T {
  const e = event as unknown as ScrubbableEvent;
  if (!e || typeof e !== 'object') return event;

  if (e.request) {
    delete e.request.data;
    delete e.request.cookies;
    if (e.request.headers) e.request.headers = scrubHeaders(e.request.headers);
    if (e.request.query_string !== undefined) {
      e.request.query_string = redactDeep(e.request.query_string);
    }
    if (typeof e.request.url === 'string') e.request.url = redactSecrets(e.request.url);
  }

  if (typeof e.message === 'string') e.message = redactSecrets(e.message);
  if (e.logentry) {
    if (typeof e.logentry.message === 'string') {
      e.logentry.message = redactSecrets(e.logentry.message);
    }
    if (Array.isArray(e.logentry.params)) {
      e.logentry.params = e.logentry.params.map((p) => redactDeep(p));
    }
  }

  for (const ex of e.exception?.values ?? []) {
    if (typeof ex.value === 'string') ex.value = redactSecrets(ex.value);
  }

  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = e.breadcrumbs.map((b) => ({
      ...b,
      ...(typeof b.message === 'string' ? { message: redactSecrets(b.message) } : {}),
      ...(b.data !== undefined ? { data: redactDeep(b.data) } : {}),
    }));
  }

  if (e.extra) e.extra = redactDeep(e.extra) as Record<string, unknown>;

  for (const span of e.spans ?? []) {
    if (typeof span.description === 'string') span.description = redactSecrets(span.description);
    if (span.data !== undefined) span.data = redactDeep(span.data);
  }

  return event;
}
