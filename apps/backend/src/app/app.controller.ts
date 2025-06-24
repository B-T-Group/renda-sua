import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly hasuraSystemService: HasuraSystemService,
  ) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('user-types')
  async getUserTypes() {
    try {
      const query = `
        query GetUserTypes {
          user_types {
            id
            name
            description
            created_at
            updated_at
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

  @Get('vehicle-types')
  async getVehicleTypes() {
    try {
      const query = `
        query GetVehicleTypes {
          vehicle_types {
            id
            name
            description
            created_at
            updated_at
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
}
