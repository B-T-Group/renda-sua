import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { rbacRequestStore } from './rbac.service';
import type { EffectiveAccess } from './platform-permissions';

/** Opens an AsyncLocalStorage cache for RbacService within each HTTP request. */
@Injectable()
export class RbacCacheInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const store = new Map<string, EffectiveAccess>();
    return new Observable((subscriber) => {
      rbacRequestStore.run(store, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
