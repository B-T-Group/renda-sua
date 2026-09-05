import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type ClientPlatform = 'web' | 'mobile';

export const PLATFORM_HEADER = 'x-client-platform';

export const Platform = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ClientPlatform => {
    const request = ctx.switchToHttp().getRequest();
    const header = request.headers[PLATFORM_HEADER]?.toLowerCase()?.trim();
    
    // Only explicit mobile/ios/android gets mobile treatment
    // web AND unknown (missing header) both use web path (session cookie, no refresh in JSON)
    if (header === 'mobile' || header === 'ios' || header === 'android') {
      return 'mobile';
    }
    
    // Default to web for unknown/missing (fail closed - no refresh_token in JSON)
    return 'web';
  }
);
