import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Logger } from 'winston';
import { AllExceptionsFilter } from './all-exceptions.filter';

jest.mock('@sentry/nestjs', () => ({
  getClient: jest.fn(),
  withScope: jest.fn((cb: (scope: unknown) => void) =>
    cb({
      setTag: jest.fn(),
      setUser: jest.fn(),
    })
  ),
  captureException: jest.fn(),
}));

jest.mock('../request-context-log.util', () => ({
  getRequestLogContext: () => ({
    requestId: 'req-123',
    userId: 'user-1',
  }),
}));

describe('AllExceptionsFilter', () => {
  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
  } as unknown as Logger;

  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  const request = {
    method: 'POST',
    url: '/api/orders',
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  let filter: AllExceptionsFilter;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new AllExceptionsFilter(logger);
  });

  it('preserves HttpException response body for 4xx and does not report to Sentry', () => {
    (Sentry.getClient as jest.Mock).mockReturnValue({});
    const body = { success: false, error: 'bad request' };
    const exception = new HttpException(body, HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(body);
    expect(logger.warn).toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('wraps string HttpException bodies like Nest default', () => {
    (Sentry.getClient as jest.Mock).mockReturnValue(undefined);
    filter.catch(
      new HttpException('Order not found', HttpStatus.NOT_FOUND),
      host
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Order not found',
    });
  });

  it('reports 5xx to Sentry and logs error', () => {
    (Sentry.getClient as jest.Mock).mockReturnValue({});
    const body = { success: false, error: 'boom' };
    const exception = new HttpException(
      body,
      HttpStatus.INTERNAL_SERVER_ERROR
    );

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(body);
    expect(logger.error).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
  });

  it('returns stable JSON body for unexpected errors', () => {
    (Sentry.getClient as jest.Mock).mockReturnValue(undefined);
    filter.catch(new Error('unexpected'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('maps transient Hasura fetch failures to 503', () => {
    (Sentry.getClient as jest.Mock).mockReturnValue({});
    const exception = new Error(
      'request to https://hasura.example.test/v1/graphql failed, reason: '
    );

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      statusCode: 503,
      message: 'Temporarily unable to reach the data service',
    });
    expect(logger.error).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
  });
});
