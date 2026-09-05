import { HttpException, HttpStatus } from '@nestjs/common';
import {
  formatHasuraNetworkError,
  HASURA_UNAVAILABLE_MESSAGE,
  isTransientHasuraNetworkError,
  isWrappedTransientHasuraHttpException,
  mapExhaustedHasuraQueryError,
  requestHasuraWithRetry,
} from './hasura-request.util';

function graphqlUnavailableError() {
  return {
    message:
      'GraphQL Error (Code: 503): {"response":{"error":"<html><title>503 Service Temporarily Unavailable</title></html>","status":503}}',
    response: {
      error: '<html><title>503 Service Temporarily Unavailable</title></html>',
      status: 503,
      headers: {},
    },
  };
}

function graphqlNginxHtml404Error() {
  return {
    message:
      'GraphQL Error (Code: 404): {"response":{"error":"<html>\\r\\n<head><title>404 Not Found</title></head>\\r\\n<body>\\r\\n<center><h1>404 Not Found</h1></center>\\r\\n<hr><center>nginx/1.24.0 (Ubuntu)</center>\\r\\n</body>\\r\\n</html>\\r\\n","status":404}}',
    response: {
      error:
        '<html>\r\n<head><title>404 Not Found</title></head>\r\n<body>\r\n<center><h1>404 Not Found</h1></center>\r\n<hr><center>nginx/1.24.0 (Ubuntu)</center>\r\n</body>\r\n</html>\r\n',
      status: 404,
      headers: {},
    },
  };
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

  it('treats nginx HTML 404 ClientErrors as transient', () => {
    expect(isTransientHasuraNetworkError(graphqlNginxHtml404Error())).toBe(
      true
    );
  });

  it('treats wrapped GraphQL 503 messages as transient', () => {
    const wrapped = new Error(
      `Failed to get user by id: ${graphqlUnavailableError().message}`
    );
    expect(isTransientHasuraNetworkError(wrapped)).toBe(true);
  });

  it('treats wrapped nginx HTML 404 messages as transient', () => {
    const wrapped = new Error(
      `Failed to get user by id: ${graphqlNginxHtml404Error().message}`
    );
    expect(isTransientHasuraNetworkError(wrapped)).toBe(true);
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
    expect(isTransientHasuraNetworkError({ response: { status: 404 } })).toBe(
      false
    );
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

  it('retries nginx HTML 404 then succeeds', async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(graphqlNginxHtml404Error())
      .mockResolvedValueOnce({ users: [{ id: 'u1' }] });

    const result = await requestHasuraWithRetry(request, undefined, {
      delayMs: 0,
    });

    expect(result).toEqual({ users: [{ id: 'u1' }] });
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

  it('maps exhausted transient query errors to HTTP 503 with a message', () => {
    let thrown: unknown;
    try {
      mapExhaustedHasuraQueryError(graphqlUnavailableError());
    } catch (error: unknown) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(HttpException);
    const exception = thrown as HttpException;
    expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(exception.message).toBe(HASURA_UNAVAILABLE_MESSAGE);
    expect(exception.getResponse()).toMatchObject({
      success: false,
      statusCode: 503,
      message: HASURA_UNAVAILABLE_MESSAGE,
    });
  });

  it('maps exhausted nginx HTML 404s to HTTP 503', () => {
    let thrown: unknown;
    try {
      mapExhaustedHasuraQueryError(graphqlNginxHtml404Error());
    } catch (error: unknown) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE
    );
  });

  it('detects controller-wrapped 500s that hide a Hasura 503', () => {
    const wrapped = new HttpException(
      {
        success: false,
        error: graphqlUnavailableError().message,
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
    expect(isWrappedTransientHasuraHttpException(wrapped)).toBe(true);
    expect(
      isWrappedTransientHasuraHttpException(
        new HttpException(
          { success: false, error: 'Order not found' },
          HttpStatus.NOT_FOUND
        )
      )
    ).toBe(false);
  });
});
