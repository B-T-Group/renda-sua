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
  /^(new_)?secret([-_]?key)?$|^client[-_]?secret$|^x[-_]secret$|^api[-_]?key$|^app[-_]?key$|^secretkey$|^password$|^pass$|^token$|^access[-_]?token$|^refresh[-_]?token$|^authorization$|^cookie$|signature/i;
/**
 * Query parameters that carry credentials in inbound URLs (QA #589 D2): feed access tokens
 * (?token=), OAuth callbacks (?code=, ?state=), signatures. Only `?name=` / `&name=` forms, or
 * `name=` at the very start of the string (#589 QA D2b: Sentry's request.query_string has no
 * leading '?', so its first parameter would otherwise slip through). Free text such as
 * "code: 500" or "zipcode=1" is untouched. Linear: no nested quantifiers.
 */
const SENSITIVE_QUERY_PARAM =
  /((?:^|[?&])(?:code|state|token|access_token|refresh_token|id_token|secret|client_secret|password|signature|sig|key|api_key|apikey)=)[^&#\s"'<>]*/gi;
const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

/** redactSecrets plus credential query parameters, for anything that may hold a URL. */
export function redactSentryString(value: string): string {
  return redactSecrets(value).replace(SENSITIVE_QUERY_PARAM, `$1${REDACTED}`);
}

/**
 * Deep copy with secret-named fields replaced and every string redacted. Never throws: an
 * unreadable value (throwing getter, exotic object) becomes a placeholder.
 */
export function redactDeep(value: unknown, depth = 0): unknown {
  try {
    if (typeof value === 'string') return redactSentryString(value);
    if (value === null || typeof value !== 'object') return value;
    if (depth >= MAX_DEPTH) return '[Truncated]';
    if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELD.test(k)) {
        out[k] = REDACTED;
        continue;
      }
      let v: unknown;
      try {
        v = (value as Record<string, unknown>)[k];
      } catch {
        out[k] = '[Unreadable]';
        continue;
      }
      out[k] = redactDeep(v, depth + 1);
    }
    return out;
  } catch {
    return '[Unreadable]';
  }
}

function scrubHeaders(headers: unknown): Record<string, unknown> | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(headers as Record<string, unknown>)) {
    if (SENSITIVE_HEADER.test(k)) {
      out[k] = REDACTED;
      continue;
    }
    try {
      out[k] = redactDeep((headers as Record<string, unknown>)[k]);
    } catch {
      out[k] = '[Unreadable]';
    }
  }
  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

type ScrubbableEvent = Record<string, unknown> & {
  request?: Record<string, unknown>;
  logentry?: Record<string, unknown>;
  exception?: { values?: unknown[] };
};

/**
 * Mutates and returns the event with request bodies, credentials and secrets removed.
 * Covers request, message, logentry, exception values, breadcrumbs, extra, spans and
 * (QA #589 D2) contexts (trace data carries http.url / url.full with the query), tags,
 * transaction and user. Null-safe (D3): non-object entries are skipped. Callers should still
 * treat a throw as "do not send" (see instrument.ts).
 */
export function scrubSentryEvent<T>(event: T): T {
  const e = event as unknown as ScrubbableEvent;
  if (!isObject(e)) return event;

  if (isObject(e.request)) {
    const req = e.request;
    delete req.data;
    delete req.cookies;
    if (req.headers !== undefined) req.headers = scrubHeaders(req.headers);
    if (req.query_string !== undefined) req.query_string = redactDeep(req.query_string);
    if (typeof req.url === 'string') req.url = redactSentryString(req.url);
    if (req.env !== undefined) req.env = redactDeep(req.env);
  }

  if (typeof e.message === 'string') e.message = redactSentryString(e.message);
  if (typeof e.transaction === 'string') e.transaction = redactSentryString(e.transaction);

  if (isObject(e.logentry)) {
    if (typeof e.logentry.message === 'string') {
      e.logentry.message = redactSentryString(e.logentry.message);
    }
    if (Array.isArray(e.logentry.params)) {
      e.logentry.params = e.logentry.params.map((p) => redactDeep(p));
    }
  }

  if (isObject(e.exception) && Array.isArray(e.exception.values)) {
    for (const ex of e.exception.values) {
      if (isObject(ex) && typeof ex.value === 'string') ex.value = redactSentryString(ex.value);
    }
  }

  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = e.breadcrumbs
      .filter(isObject)
      .map((b) => redactDeep(b) as Record<string, unknown>);
  }

  if (Array.isArray(e.spans)) {
    e.spans = e.spans.filter(isObject).map((span) => {
      if (typeof span.description === 'string') {
        span.description = redactSentryString(span.description);
      }
      if (span.data !== undefined) span.data = redactDeep(span.data);
      return span;
    });
  }

  for (const key of ['extra', 'contexts', 'tags', 'user'] as const) {
    if (e[key] !== undefined && e[key] !== null) e[key] = redactDeep(e[key]);
  }

  return event;
}
