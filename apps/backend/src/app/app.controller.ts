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
}
