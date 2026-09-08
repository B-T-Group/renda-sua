import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import type { Configuration, MobileAppConfig } from '../config/configuration';

export type MobileVersionPolicyDto = {
  minVersion: string | null;
  recommendedVersion: string | null;
};

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService<Configuration>,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  getHello(): string {
    this.logger.info('Hello endpoint called', {
      service: 'AppService',
      method: 'getHello',
      timestamp: new Date().toISOString(),
    });

    return 'Hello World!';
  }

  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  getMobileVersionPolicy(): MobileVersionPolicyDto {
    const mobileApp = this.configService.get<MobileAppConfig>('mobileApp');
    return {
      minVersion: this.nonEmpty(mobileApp?.minVersion),
      recommendedVersion: this.nonEmpty(mobileApp?.recommendedVersion),
    };
  }

  private nonEmpty(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  logError(): void {
    try {
      throw new Error('This is a test error');
    } catch (error) {
      this.logger.error('An error occurred', {
        service: 'AppService',
        method: 'logError',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
