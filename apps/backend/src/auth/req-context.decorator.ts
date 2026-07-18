import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import {
  REQUEST_CONTEXT_CLS_KEY,
  type RequestContext,
} from './request-context';
import { buildRequestContextFromHeaders } from './request-context.util';

/**
 * Resolves the current RequestContext from nestjs-cls, falling back to
 * request headers when CLS is empty (e.g. early in the pipeline).
 */
export const ReqContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext => {
    try {
      const cls = ClsServiceManager.getClsService();
      const stored = cls?.get<RequestContext>(REQUEST_CONTEXT_CLS_KEY);
      if (stored) {
        return stored;
      }
    } catch {
      // CLS not available
    }
    const request = ctx.switchToHttp().getRequest<{
      headers?: Record<string, unknown>;
    }>();
    return buildRequestContextFromHeaders(request?.headers);
  }
);
