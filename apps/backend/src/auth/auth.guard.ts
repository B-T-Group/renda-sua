import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import { ClsService } from 'nestjs-cls';
import { IS_PUBLIC_KEY } from './public.decorator';
import { setupRequestContextCls } from './request-context-cls.setup';

interface RequestWithUser extends Request {
  user?: any;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private jwksClient: jwksClient.JwksClient;

  constructor(
    private configService: ConfigService,
    private reflector: Reflector,
    private readonly cls: ClsService
  ) {
    // Initialize JWKS client lazily to ensure configuration is loaded
    this.jwksClient = null as any;
  }

  private getJwksClient(): jwksClient.JwksClient {
    if (!this.jwksClient) {
      const auth0Config = this.configService.get('auth0');

      if (!auth0Config?.domain) {
        this.logger.error('AUTH0_DOMAIN environment variable is required');
        throw new Error('AUTH0_DOMAIN environment variable is required');
      }

      this.jwksClient = new jwksClient.JwksClient({
        jwksUri: `https://${auth0Config.domain}/.well-known/jwks.json`,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 600000, // 10 minutes
      });
    }
    return this.jwksClient;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractTokenFromHeader(request);

    if (isPublic) {
      if (token) {
        try {
          request.user = await this.verifyToken(token);
        } catch (error) {
          // Optional auth: ignore invalid/expired tokens on public routes so
          // downstream services (e.g. HasuraUserService) treat the caller as anonymous.
          this.logger.debug(
            `Public route: ignoring invalid token (${(error as Error).message})`
          );
          this.stripAuthorizationHeader(request);
          delete request.user;
          // CLS was populated from the unverified Bearer before guards ran.
          this.refreshRequestContextCls(request);
        }
      }
      return true;
    }

    if (!token) {
      this.logger.warn('No authorization token provided');
      throw new UnauthorizedException('No authorization token provided');
    }

    try {
      const payload = await this.verifyToken(token);
      request.user = payload;
      return true;
    } catch (error) {
      this.logger.error('Token verification failed', (error as Error).message);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private stripAuthorizationHeader(request: Request): void {
    if (!request.headers) return;
    delete request.headers.authorization;
    delete (request.headers as Record<string, unknown>)['Authorization'];
  }

  /** Rebuild CLS RequestContext after headers change (e.g. stripped bad token). */
  private refreshRequestContextCls(request: Request): void {
    try {
      setupRequestContextCls(this.cls, request);
    } catch (error: any) {
      this.logger.warn(
        `Failed to refresh request CLS after stripping token: ${
          error?.message || error
        }`
      );
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private async verifyToken(token: string): Promise<any> {
    const auth0Config = this.configService.get('auth0');
    const jwksClient = this.getJwksClient();

    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          jwksClient.getSigningKey(header.kid, (err, key) => {
            if (err) {
              return callback(err);
            }
            if (!key) {
              return callback(new Error('Signing key not found'));
            }
            const signingKey = key.getPublicKey();
            callback(null, signingKey);
          });
        },
        {
          audience: auth0Config.audience,
          issuer: `https://${auth0Config.domain}/`,
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err) {
            return reject(err);
          }
          resolve(decoded);
        }
      );
    });
  }
}
