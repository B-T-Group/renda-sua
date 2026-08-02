import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { Logger } from 'winston';
import { LoggingInterceptor } from './logging.interceptor';

jest.mock('../request-context-log.util', () => ({
  getRequestLogContext: () => ({ requestId: 'req-abc' }),
}));

describe('LoggingInterceptor', () => {
  const logger = {
    info: jest.fn(),
  } as unknown as Logger;

  const response = {
    statusCode: 200,
    setHeader: jest.fn(),
  };

  const request = {
    method: 'GET',
    url: '/api/health?code=secret-oauth',
    originalUrl: '/api/health?code=secret-oauth',
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    response.statusCode = 200;
    interceptor = new LoggingInterceptor(logger);
  });

  it('sets X-Request-Id and logs access on success', (done) => {
    const next: CallHandler = { handle: () => of({ ok: true }) };

    interceptor.intercept(context, next).subscribe({
      complete: () => {
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-Request-Id',
          'req-abc'
        );
        expect(logger.info).toHaveBeenCalledWith(
          'HTTP request',
          expect.objectContaining({
            method: 'GET',
            path: '/api/health',
            status: 200,
            requestId: 'req-abc',
            durationMs: expect.any(Number),
          })
        );
        expect(logger.info).not.toHaveBeenCalledWith(
          'HTTP request',
          expect.objectContaining({ path: expect.stringContaining('code=') })
        );
        done();
      },
    });
  });

  it('logs HttpException status on error even when response is still 200', (done) => {
    const next: CallHandler = {
      handle: () =>
        throwError(
          () =>
            new HttpException(
              { success: false },
              HttpStatus.INTERNAL_SERVER_ERROR
            )
        ),
    };

    interceptor.intercept(context, next).subscribe({
      error: () => {
        expect(logger.info).toHaveBeenCalledWith(
          'HTTP request',
          expect.objectContaining({
            status: 500,
            requestId: 'req-abc',
          })
        );
        done();
      },
    });
  });

  it('logs 500 for unexpected errors when response is still 200', (done) => {
    const next: CallHandler = {
      handle: () => throwError(() => new Error('fail')),
    };

    interceptor.intercept(context, next).subscribe({
      error: () => {
        expect(logger.info).toHaveBeenCalledWith(
          'HTTP request',
          expect.objectContaining({
            status: 500,
            requestId: 'req-abc',
          })
        );
        done();
      },
    });
  });
});
