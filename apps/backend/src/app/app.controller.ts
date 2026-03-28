import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Public } from '../auth/public.decorator';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { PersonaId } from '../users/persona.types';
import { isPersonaId } from '../users/persona.types';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly hasuraSystemService: HasuraSystemService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  @Public()
  @Get('health')
  async getHealth(): Promise<{
    status: string;
    timestamp: string;
    hasura?: { status: string; latencyMs?: number };
  }> {
    this.logger.info('GET /health endpoint called', {
      service: 'AppController',
      method: 'getHealth',
      endpoint: '/health',
      timestamp: new Date().toISOString(),
    });

    const base = this.appService.getHealth();
    let hasura: { status: string; latencyMs?: number } | undefined;
    try {
      const start = Date.now();
      await this.hasuraSystemService.executeQuery(
        'query Health { user_types(limit: 1) { id } }',
        {}
      );
      const latencyMs = Date.now() - start;
      hasura = { status: 'up', latencyMs };
    } catch (err) {
      this.logger.warn('Health check: Hasura unreachable', {
        error: err instanceof Error ? err.message : String(err),
      });
      hasura = { status: 'down' };
    }
    return {
      ...base,
      hasura,
    };
  }

  @Public()
  @Get('metrics')
  getMetrics(): string {
    const uptimeSeconds = process.uptime();
    return [
      '# HELP app_uptime_seconds Application uptime in seconds',
      '# TYPE app_uptime_seconds gauge',
      `app_uptime_seconds ${uptimeSeconds}`,
    ].join('\n');
  }

  @Get()
  getHello(): string {
    this.logger.info('GET / endpoint called', {
      service: 'AppController',
      method: 'getHello',
      endpoint: '/',
      timestamp: new Date().toISOString(),
    });

    return this.appService.getHello();
  }

  @Get('user_types')
  async getUserTypes() {
    try {
      const query = `
        query GetUserTypes {
          user_types {
            id
            comment
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(query);
      return {
        success: true,
        user_types: result.user_types,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('vehicle_types')
  async getVehicleTypes() {
    try {
      const query = `
        query GetVehicleTypes {
          vehicle_types {
            id
            comment
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(query);
      return {
        success: true,
        vehicle_types: result.vehicle_types,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('test-user')
  async createTestUser(
    @Body()
    userData: {
      first_name: string;
      last_name: string;
      /** @deprecated use `personas` */
      user_type_id?: string;
      personas?: PersonaId[];
      profile: {
        vehicle_type_id?: string;
        name?: string;
        main_interest?: 'sell_items' | 'rent_items';
      };
    }
  ) {
    try {
      const email = `test-${Date.now()}@example.com`;
      let personas: PersonaId[] = [];
      if (userData.personas?.length) {
        personas = [...new Set(userData.personas)].filter(isPersonaId);
      } else if (userData.user_type_id && isPersonaId(userData.user_type_id)) {
        personas = [userData.user_type_id];
      }
      if (personas.length === 0) {
        throw new Error('personas or user_type_id is required');
      }
      if (personas.includes('business') && !userData.profile?.name?.trim()) {
        throw new Error('business name is required when business is in personas');
      }
      const inserted = await this.hasuraSystemService.insertUserWithPersonas({
        email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        phone_number: null,
        email_verified: false,
        personas,
        vehicle_type_id: userData.profile?.vehicle_type_id,
        business_name:
          userData.profile?.name?.trim() ||
          `${userData.first_name}'s Business`,
        main_interest: userData.profile?.main_interest ?? 'sell_items',
      });
      return { success: true, ...inserted };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('test-error')
  testError(): void {
    this.logger.warn(
      'GET /test-error endpoint called - testing error logging',
      {
        service: 'AppController',
        method: 'testError',
        endpoint: '/test-error',
        timestamp: new Date().toISOString(),
      }
    );

    this.appService.logError();
  }
}
