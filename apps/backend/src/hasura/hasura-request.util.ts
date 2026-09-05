import { HttpException, HttpStatus } from '@nestjs/common';

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
  /GraphQL Error \(Code: 50[234]\)/i,
  /Service Temporarily Unavailable/i,
];

const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);

export const HASURA_UNAVAILABLE_MESSAGE =
  'Temporarily unable to reach the data service';

export type HasuraRetryLogger = {
  warn: (message: string) => void;
};

type HasuraErrorShape = {
  response?: {
    status?: number;
    statusCode?: number;
    errors?: unknown;
    error?: unknown;
  };
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
  if (isRetryableHttpStatus(httpStatusOf(err))) return true;
  if (isTransientNginxHtml404(err)) return true;
  if (hasGraphQLApplicationErrors(err)) return false;
  if (matchesTransientMessage(err)) return true;
  if (err.response) return false;
  return isTransientTransportError(err);
}

export function isWrappedTransientHasuraHttpException(
  error: unknown
): boolean {
  if (!(error instanceof HttpException)) return false;
  if (error.getStatus() !== HttpStatus.INTERNAL_SERVER_ERROR) return false;
  const cause = (error as { cause?: unknown }).cause;
  if (isTransientHasuraNetworkError(cause)) return true;
  return isTransientHasuraNetworkError({ message: httpExceptionText(error) });
}

export function hasuraUnavailableResponse(): {
  success: false;
  statusCode: number;
  message: string;
  error: string;
} {
  return {
    success: false,
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    message: HASURA_UNAVAILABLE_MESSAGE,
    error: HASURA_UNAVAILABLE_MESSAGE,
  };
}

export function mapExhaustedHasuraQueryError(error: unknown): never {
  if (error instanceof HttpException) {
    throw error;
  }
  if (isTransientHasuraNetworkError(error)) {
    throw new HttpException(
      hasuraUnavailableResponse(),
      HttpStatus.SERVICE_UNAVAILABLE,
      { cause: error instanceof Error ? error : undefined }
    );
  }
  throw error;
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

function httpStatusOf(err: HasuraErrorShape): number | undefined {
  return err.response?.status ?? err.response?.statusCode;
}

function isRetryableHttpStatus(status?: number): boolean {
  return status != null && RETRYABLE_HTTP_STATUSES.has(status);
}

function hasGraphQLApplicationErrors(err: HasuraErrorShape): boolean {
  return Array.isArray(err.response?.errors) && err.response.errors.length > 0;
}

function gatewayErrorText(err: HasuraErrorShape): string {
  return `${err.message || ''} ${stringifyResponseError(err.response?.error)}`;
}

function isTransientNginxHtml404(err: HasuraErrorShape): boolean {
  const text = gatewayErrorText(err);
  const isNginxHtml404 =
    /<\s*html/i.test(text) && /404 Not Found/i.test(text);
  if (!isNginxHtml404) return false;
  return (
    httpStatusOf(err) === 404 || /GraphQL Error \(Code: 404\)/i.test(text)
  );
}

function matchesTransientMessage(err: HasuraErrorShape): boolean {
  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) =>
    pattern.test(gatewayErrorText(err))
  );
}

function stringifyResponseError(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isTransientTransportError(err: HasuraErrorShape): boolean {
  const code = err.code || err.cause?.code;
  if (code && TRANSIENT_CODES.has(code)) return true;
  if (err.type === 'system') return true;
  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) =>
    pattern.test(String(err.message || ''))
  );
}

function httpExceptionText(error: HttpException): string {
  const response = error.getResponse();
  if (typeof response === 'string') return response;
  if (!response || typeof response !== 'object') return error.message;
  const rec = response as { error?: unknown; message?: unknown };
  return [rec.error, rec.message, error.message]
    .filter((value) => typeof value === 'string')
    .join(' ');
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
