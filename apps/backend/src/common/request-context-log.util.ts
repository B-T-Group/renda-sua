import { ClsServiceManager } from 'nestjs-cls';
import {
  REQUEST_CONTEXT_CLS_KEY,
  type RequestContext,
} from '../auth/request-context';

export type RequestLogContext = {
  requestId?: string;
  userId?: string;
};

/** Read requestId/userId from CLS when a request is active. */
export function getRequestLogContext(): RequestLogContext {
  try {
    const cls = ClsServiceManager.getClsService();
    const ctx = cls?.get<RequestContext>(REQUEST_CONTEXT_CLS_KEY);
    if (!ctx) {
      return {};
    }
    return {
      requestId: ctx.requestId,
      userId: ctx.userId,
    };
  } catch {
    return {};
  }
}
