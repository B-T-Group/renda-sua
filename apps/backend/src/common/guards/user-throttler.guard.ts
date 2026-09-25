import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { ThrottlerRequest } from '@nestjs/throttler/dist/throttler.guard.interface';
import { IS_PUBLIC_KEY } from '../../auth/public.decorator';

/**
 * Rate limits by authenticated user id on protected routes; public routes
 * and anonymous callers are tracked by IP (including Bearer on @Public()).
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector
  ) {
    super(options, storageService, reflector);
  }

  protected override async handleRequest(
    requestProps: ThrottlerRequest
  ): Promise<boolean> {
    const { context } = requestProps;
    return super.handleRequest({
      ...requestProps,
      getTracker: async (req) => this.resolveTracker(req, context),
    });
  }

  private async resolveTracker(
    req: Record<string, any>,
    context: ExecutionContext
  ): Promise<string> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return `ip-${req.ip}`;
    }
    const sub = req.user?.sub;
    if (sub) {
      return `user-${sub}`;
    }
    return `ip-${req.ip}`;
  }
}
