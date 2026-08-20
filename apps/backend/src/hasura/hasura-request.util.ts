const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

const TRANSIENT_MESSAGE_PATTERNS = [
  /request to .+ failed, reason:/i,
  /socket hang up/i,
  /network timeout/i,
  /fetch failed/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ECONNREFUSED/i,
];

const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);
const GRAPHQL_HTTP_CODE = /GraphQL Error \(Code: (\d+)\)/i;

export type HasuraRetryLogger = {
  warn: (message: string) => void;
};

type HasuraErrorShape = {
  response?: { status?: number; statusCode?: number; errors?: unknown };
  code?: string;
  type?: string;
  message?: string;
  cause?: { code?: string; message?: string };
};

export function formatHasuraNetworkError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error || 'Unknown error');
  }
  const err = error as HasuraErrorShape;
  const parts = [err.message || 'Unknown error'];
  const code = err.code || err.cause?.code;
  if (code) parts.push(`code=${code}`);
  if (err.type) parts.push(`type=${err.type}`);
  if (err.cause?.message && err.cause.message !== err.message) {
    parts.push(`cause=${err.cause.message}`);
  }
  return parts.join(' ');
}

export function isTransientHasuraNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as HasuraErrorShape;
  const status = resolveHasuraHttpStatus(err);
  if (status != null) return RETRYABLE_HTTP_STATUSES.has(status);
  if (err.response) return false;
  const code = err.code || err.cause?.code;
  if (code && TRANSIENT_CODES.has(code)) return true;
  if (err.type === 'system') return true;
  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) =>
    pattern.test(String(err.message || ''))
  );
}

export async function requestHasuraWithRetry<T>(
  request: () => Promise<T>,
  logger?: HasuraRetryLogger,
  options?: { maxAttempts?: number; delayMs?: number }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const delayMs = options?.delayMs ?? 100;
  return retryHasuraAttempt(request, logger, maxAttempts, delayMs, 1);
}

function resolveHasuraHttpStatus(err: HasuraErrorShape): number | undefined {
  const fromResponse = err.response?.status ?? err.response?.statusCode;
  if (typeof fromResponse === 'number') return fromResponse;
  const match = String(err.message || '').match(GRAPHQL_HTTP_CODE);
  return match ? Number(match[1]) : undefined;
}

async function retryHasuraAttempt<T>(
  request: () => Promise<T>,
  logger: HasuraRetryLogger | undefined,
  maxAttempts: number,
  delayMs: number,
  attempt: number
): Promise<T> {
  try {
    return await request();
  } catch (error: any) {
    if (attempt >= maxAttempts || !isTransientHasuraNetworkError(error)) {
      throw error;
    }
    logger?.warn(
      `Transient Hasura query failed (attempt ${attempt}/${maxAttempts}): ${formatHasuraNetworkError(error)}`
    );
    await sleep(delayMs * attempt);
    return retryHasuraAttempt(
      request,
      logger,
      maxAttempts,
      delayMs,
      attempt + 1
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
