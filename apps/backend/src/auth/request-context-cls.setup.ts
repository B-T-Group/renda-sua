import { ClsService } from 'nestjs-cls';
import { REQUEST_CONTEXT_CLS_KEY } from './request-context';
import { buildRequestContextFromHeaders } from './request-context.util';

/** Populate nestjs-cls with RequestContext for the current HTTP request. */
export function setupRequestContextCls(
  cls: ClsService,
  req: { headers?: Record<string, unknown> }
): void {
  const ctx = buildRequestContextFromHeaders(req?.headers);
  cls.set(REQUEST_CONTEXT_CLS_KEY, ctx);
}
