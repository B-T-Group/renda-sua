import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { isTransientHasuraNetworkError } from '../../hasura/hasura-request.util';
import { getRequestLogContext } from '../request-context-log.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = this.resolveStatus(exception);
    const body = this.resolveBody(exception, status);
    const logCtx = getRequestLogContext();

    this.logException(exception, request, status, logCtx);
    this.reportToSentry(exception, status, request, logCtx);
    response.status(status).json(body);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (isTransientHasuraNetworkError(exception)) {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveBody(exception: unknown, status: number): object {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return { statusCode: status, message: response };
      }
      return response as object;
    }
    if (isTransientHasuraNetworkError(exception)) {
      return {
        success: false,
        statusCode: status,
        message: 'Temporarily unable to reach the data service',
      };
    }
    return {
      success: false,
      statusCode: status,
      message: 'Internal server error',
    };
  }

  private logException(
    exception: unknown,
    request: Request,
    status: number,
    logCtx: { requestId?: string; userId?: string }
  ): void {
    const message =
      exception instanceof Error ? exception.message : String(exception);
    const meta = {
      status,
      method: request.method,
      path: this.pathWithoutQuery(request),
      requestId: logCtx.requestId,
      userId: logCtx.userId,
      stack: exception instanceof Error ? exception.stack : undefined,
    };
    if (status >= 500) {
      this.logger.error(message, meta);
      return;
    }
    this.logger.warn(message, meta);
  }

  private reportToSentry(
    exception: unknown,
    status: number,
    request: Request,
    logCtx: { requestId?: string; userId?: string }
  ): void {
    if (status < 500 || !Sentry.getClient()) {
      return;
    }
    Sentry.withScope((scope) => {
      scope.setTag('path', this.pathWithoutQuery(request));
      scope.setTag('method', request.method);
      if (logCtx.requestId) {
        scope.setTag('requestId', logCtx.requestId);
      }
      if (logCtx.userId && logCtx.userId !== 'anonymous') {
        scope.setUser({ id: logCtx.userId });
      }
      Sentry.captureException(exception);
    });
  }

  private pathWithoutQuery(request: Request): string {
    const raw = request.originalUrl || request.url || '';
    const q = raw.indexOf('?');
    return q === -1 ? raw : raw.slice(0, q);
  }
}
