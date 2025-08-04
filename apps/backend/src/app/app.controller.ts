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
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly hasuraSystemService: HasuraSystemService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    this.logger.info('GET /health endpoint called', {
      service: 'AppController',
      method: 'getHealth',
      endpoint: '/health',
      timestamp: new Date().toISOString(),
    });

    return this.appService.getHealth();
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
      user_type_id: string;
      profile: {
        vehicle_type_id?: string;
        name?: string;
      };
    }
  ) {
    try {
      // Use system service to create user without authentication
      const email = `test-${Date.now()}@example.com`;

      let result: any;

      switch (userData.user_type_id) {
        case 'client':
          result = await this.hasuraSystemService.executeMutation(
            `
            mutation CreateUserWithClient($identifier: String!, $email: String!, $first_name: String!, $last_name: String!, $user_type_id: String!) {
              insert_users_one(object: {
                identifier: $identifier,
                email: $email,
                first_name: $first_name,
                last_name: $last_name,
                user_type_id: $user_type_id,
                client: {
                  data: {}
                }
              }) {
                id
                identifier
                email
                first_name
                last_name
                user_type_id
                created_at
                updated_at
                clients {
                  id
                  user_id
                  created_at
                  updated_at
                }
              }
            }
          `,
            {
              identifier: `test-${Date.now()}`,
              email: email,
              first_name: userData.first_name,
              last_name: userData.last_name,
              user_type_id: userData.user_type_id,
            }
          );
          return {
            success: true,
            user: result.insert_users_one,
            client: result.insert_users_one.clients[0],
          };

        case 'agent':
          if (!userData.profile.vehicle_type_id) {
            throw new Error('vehicle_type_id is required for agent users');
          }
          result = await this.hasuraSystemService.executeMutation(
            `
            mutation CreateUserWithAgent($identifier: String!, $email: String!, $first_name: String!, $last_name: String!, $user_type_id: String!, $vehicle_type_id: String!) {
              insert_users_one(object: {
                identifier: $identifier,
                email: $email,
                first_name: $first_name,
                last_name: $last_name,
                user_type_id: $user_type_id,
                agent: {
                  data: {
                    vehicle_type_id: $vehicle_type_id
                  }
                }
              }) {
                id
                identifier
                email
                first_name
                last_name
                user_type_id
                created_at
                updated_at
                agents {
                  id
                  user_id
                  vehicle_type_id
                  created_at
                  updated_at
                }
              }
            }
          `,
            {
              identifier: `test-${Date.now()}`,
              email: email,
              first_name: userData.first_name,
              last_name: userData.last_name,
              user_type_id: userData.user_type_id,
              vehicle_type_id: userData.profile.vehicle_type_id,
            }
          );
          return {
            success: true,
            user: result.insert_users_one,
            agent: result.insert_users_one.agents[0],
          };

        case 'business':
          if (!userData.profile.name) {
            throw new Error('business name is required for business users');
          }
          result = await this.hasuraSystemService.executeMutation(
            `
            mutation CreateUserWithBusiness($identifier: String!, $email: String!, $first_name: String!, $last_name: String!, $user_type_id: String!, $name: String!) {
              insert_users_one(object: {
                identifier: $identifier,
                email: $email,
                first_name: $first_name,
                last_name: $last_name,
                user_type_id: $user_type_id,
                business: {
                  data: {
                    name: $name
                  }
                }
              }) {
                id
                identifier
                email
                first_name
                last_name
                user_type_id
                created_at
                updated_at
                business {
                  id
                  user_id
                  name
                  is_admin
                  is_verified
                  created_at
                  updated_at
                }
              }
            }
          `,
            {
              identifier: `test-${Date.now()}`,
              email: email,
              first_name: userData.first_name,
              last_name: userData.last_name,
              user_type_id: userData.user_type_id,
              name: userData.profile.name,
            }
          );
          return {
            success: true,
            user: result.insert_users_one,
            business: result.insert_users_one.business,
          };

        default:
          throw new Error('Invalid user type');
      }
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
