import { HttpException, HttpStatus } from '@nestjs/common';
import {
  isRetryableHasuraError,
  requestHasuraWithRetry,
  toHasuraHttpException,
} from './hasura-request.util';

function clientError(status: number, message = `GraphQL Error (Code: ${status})`) {
  const error = new Error(message) as Error & {
    response: { status: number };
  };
  error.response = { status };
  return error;
}

describe('hasura-request.util', () => {
  describe('isRetryableHasuraError', () => {
    it('retries gateway 502/503/504 ClientErrors', () => {
      expect(isRetryableHasuraError(clientError(503))).toBe(true);
      expect(isRetryableHasuraError(clientError(502))).toBe(true);
      expect(isRetryableHasuraError(clientError(504))).toBe(true);
    });

    it('does not retry GraphQL validation or auth failures', () => {
      expect(isRetryableHasuraError(clientError(200))).toBe(false);
      expect(isRetryableHasuraError(clientError(400))).toBe(false);
      expect(isRetryableHasuraError(clientError(401))).toBe(false);
    });

    it('retries FetchError and known network errno', () => {
      const fetchError = new Error(
        'request to https://example.test/v1/graphql failed, reason:'
      );
      fetchError.name = 'FetchError';
      expect(isRetryableHasuraError(fetchError)).toBe(true);

      const reset = new Error('socket hang up') as Error & { code: string };
      reset.code = 'ECONNRESET';
      expect(isRetryableHasuraError(reset)).toBe(true);
    });
  });

  describe('requestHasuraWithRetry', () => {
    it('returns on first success', async () => {
      const requestFn = jest.fn().mockResolvedValue({ ok: true });
      await expect(requestHasuraWithRetry(requestFn)).resolves.toEqual({
        ok: true,
      });
      expect(requestFn).toHaveBeenCalledTimes(1);
    });

    it('retries 503 then succeeds', async () => {
      const requestFn = jest
        .fn()
        .mockRejectedValueOnce(clientError(503))
        .mockResolvedValue({ accounts: [] });
      const sleep = jest.fn().mockResolvedValue(undefined);

      await expect(
        requestHasuraWithRetry(requestFn, { sleep, delaysMs: [0, 0] })
      ).resolves.toEqual({ accounts: [] });
      expect(requestFn).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
    });

    it('does not retry mutations-style ClientError 400', async () => {
      const requestFn = jest.fn().mockRejectedValue(clientError(400));
      const sleep = jest.fn().mockResolvedValue(undefined);

      await expect(
        requestHasuraWithRetry(requestFn, { sleep })
      ).rejects.toMatchObject({ response: { status: 400 } });
      expect(requestFn).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('rethrows after exhausting retries', async () => {
      const err = clientError(503);
      const requestFn = jest.fn().mockRejectedValue(err);
      const sleep = jest.fn().mockResolvedValue(undefined);

      await expect(
        requestHasuraWithRetry(requestFn, {
          sleep,
          maxAttempts: 3,
          delaysMs: [0, 0],
        })
      ).rejects.toBe(err);
      expect(requestFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('toHasuraHttpException', () => {
    it('maps retryable Hasura errors to 503', () => {
      const mapped = toHasuraHttpException(
        clientError(503),
        'Failed to fetch account info'
      );
      expect(mapped.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mapped.getResponse()).toMatchObject({
        success: false,
        error: 'Service temporarily unavailable',
        message: 'Service temporarily unavailable',
      });
    });

    it('preserves existing HttpException', () => {
      const original = new HttpException('nope', HttpStatus.UNAUTHORIZED);
      expect(toHasuraHttpException(original, 'fallback')).toBe(original);
    });

    it('wraps other errors as 500 with the original message', () => {
      const mapped = toHasuraHttpException(
        new Error('invalid input syntax for type uuid'),
        'Failed to fetch account info'
      );
      expect(mapped.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mapped.getResponse()).toMatchObject({
        success: false,
        error: 'invalid input syntax for type uuid',
        message: 'invalid input syntax for type uuid',
      });
    });
  });
});
