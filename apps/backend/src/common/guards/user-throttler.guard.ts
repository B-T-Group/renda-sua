import { Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { ClsService } from 'nestjs-cls';
import {
  REQUEST_CONTEXT_CLS_KEY,
  RequestContext,
} from '../../auth/request-context';

/**
 * Custom throttler guard that tracks rate limits by user ID when authenticated,
 * falling back to IP address for anonymous requests.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(UserThrottlerGuard.name);
  private readonly cls: ClsService;

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    cls: ClsService
  ) {
    super(options, storageService, reflector);
    this.cls = cls;
  }

  protected override async getTracker(
    req: Record<string, any>
  ): Promise<string> {
    const ctx = this.cls.get<RequestContext>(REQUEST_CONTEXT_CLS_KEY);

    if (ctx?.userId && ctx.userId !== 'anonymous') {
      const tracker = `user-${ctx.userId}`;
      this.logger.debug(`Throttle tracker: ${tracker}`);
      return tracker;
    }

    const ip = req.ips?.length ? req.ips[0] : req.ip;
    const tracker = `ip-${ip}`;
    this.logger.debug(`Throttle tracker: ${tracker}`);
    return tracker;
  }
}
