import {
  formatHasuraNetworkError,
  isTransientHasuraNetworkError,
  requestHasuraWithRetry,
} from './hasura-request.util';

function graphqlUnavailableError(status = 503): Error {
  const html = `<html><head><title>${status} Service Temporarily Unavailable</title></head></html>`;
  return Object.assign(
    new Error(
      `GraphQL Error (Code: ${status}): ${JSON.stringify({
        response: { error: html },
      })}`
    ),
    { response: { status, error: html } }
  );
}

describe('hasura-request.util', () => {
  it('treats empty-reason Hasura fetch failures as transient', () => {
    const error = new Error(
      'request to https://hasura.example.test/v1/graphql failed, reason: '
    );
    expect(isTransientHasuraNetworkError(error)).toBe(true);
  });

  it('treats graphql-request HTML 503 ClientErrors as transient', () => {
    expect(isTransientHasuraNetworkError(graphqlUnavailableError())).toBe(true);
  });

  it('treats wrapped GraphQL Error (Code: 503) messages as transient', () => {
    const error = new Error(
      'Failed to get user by id: GraphQL Error (Code: 503): {"response":{"error":"<html>503 Service Temporarily Unavailable</html>"}}'
    );
    expect(isTransientHasuraNetworkError(error)).toBe(true);
  });

  it('treats node-fetch system errors and known codes as transient', () => {
    expect(
      isTransientHasuraNetworkError({ type: 'system', message: 'failed' })
    ).toBe(true);
    expect(isTransientHasuraNetworkError({ code: 'ECONNRESET' })).toBe(true);
    expect(
      isTransientHasuraNetworkError({ cause: { code: 'ETIMEDOUT' } })
    ).toBe(true);
    expect(isTransientHasuraNetworkError({ response: { status: 503 } })).toBe(
      true
    );
  });

  it('does not retry GraphQL or client errors', () => {
    expect(
      isTransientHasuraNetworkError({
        message: 'invalid input syntax for type uuid',
        response: { errors: [{ message: 'invalid input syntax' }] },
      })
    ).toBe(false);
    expect(isTransientHasuraNetworkError({ response: { status: 400 } })).toBe(
      false
    );
    expect(
      isTransientHasuraNetworkError(
        new Error('GraphQL Error (Code: 400): {"response":{"errors":[]}}')
      )
    ).toBe(false);
    expect(isTransientHasuraNetworkError(new Error('User not found'))).toBe(
      false
    );
  });

  it('includes code and type in formatted network errors', () => {
    const formatted = formatHasuraNetworkError({
      message:
        'request to https://hasura.example.test/v1/graphql failed, reason: ',
      code: 'ECONNRESET',
      type: 'system',
    });
    expect(formatted).toContain('code=ECONNRESET');
    expect(formatted).toContain('type=system');
  });

  it('retries transient failures then succeeds', async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(graphqlUnavailableError())
      .mockResolvedValueOnce({ users_by_pk: { id: 'u1' } });

    const result = await requestHasuraWithRetry(request, undefined, {
      delayMs: 0,
    });

    expect(result).toEqual({ users_by_pk: { id: 'u1' } });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not retry application errors', async () => {
    const error = {
      message: 'invalid input syntax for type uuid',
      response: { errors: [{ message: 'invalid input syntax' }] },
    };
    const request = jest.fn().mockRejectedValue(error);

    await expect(
      requestHasuraWithRetry(request, undefined, { delayMs: 0 })
    ).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rethrows after exhausting transient retries', async () => {
    const error = graphqlUnavailableError();
    const request = jest.fn().mockRejectedValue(error);

    await expect(
      requestHasuraWithRetry(request, undefined, {
        maxAttempts: 3,
        delayMs: 0,
      })
    ).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(3);
  });
});
