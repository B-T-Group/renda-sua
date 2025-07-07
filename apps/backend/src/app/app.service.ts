import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class AppService {
  constructor(
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
    this.logger.info('Health check endpoint called', {
      service: 'AppService',
      method: 'getHealth',
      timestamp: new Date().toISOString(),
    });

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
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
