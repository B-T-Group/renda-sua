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
import { IS_PUBLIC_KEY } from './public.decorator';

interface RequestWithUser extends Request {
  user?: any;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private jwksClient: jwksClient.JwksClient;

  constructor(
    private configService: ConfigService,
    private reflector: Reflector
  ) {
    const auth0Config = this.configService.get('auth0');
    if (!auth0Config?.domain) {
      throw new Error('AUTH0_DOMAIN environment variable is required');
    }

    this.jwksClient = new jwksClient.JwksClient({
      jwksUri: `https://${auth0Config.domain}/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractTokenFromHeader(request);

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

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private async verifyToken(token: string): Promise<any> {
    const auth0Config = this.configService.get('auth0');

    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          this.jwksClient.getSigningKey(header.kid, (err, key) => {
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
