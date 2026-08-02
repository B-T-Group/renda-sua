import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Observable, tap } from 'rxjs';
import { Logger } from 'winston';
import { getRequestLogContext } from '../request-context-log.util';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const { requestId } = getRequestLogContext();

    if (requestId) {
      response.setHeader('X-Request-Id', requestId);
    }

    return next.handle().pipe(
      tap({
        next: () =>
          this.logAccess(request, response.statusCode, startedAt, requestId),
        error: (err: unknown) =>
          this.logAccess(
            request,
            this.resolveErrorStatus(err),
            startedAt,
            requestId
          ),
      })
    );
  }

  private resolveErrorStatus(err: unknown): number {
    if (err instanceof HttpException) {
      return err.getStatus();
    }
    return 500;
  }

  private logAccess(
    request: Request,
    status: number,
    startedAt: number,
    requestId?: string
  ): void {
    this.logger.info('HTTP request', {
      method: request.method,
      path: this.pathWithoutQuery(request),
      status,
      durationMs: Date.now() - startedAt,
      requestId,
    });
  }

  /** Avoid logging OAuth codes and other secrets in query strings. */
  private pathWithoutQuery(request: Request): string {
    const raw = request.originalUrl || request.url || '';
    const q = raw.indexOf('?');
    return q === -1 ? raw : raw.slice(0, q);
  }
}
