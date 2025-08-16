import { Body, Controller, Get, Post } from '@nestjs/common';
import { HasuraSystemService } from './hasura-system.service';
import { HasuraUserService } from './hasura-user.service';

// Note: In a real application, you would implement proper JWT authentication guards
// For now, this is a simplified example

@Controller('hasura')
export class HasuraController {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get('system/status')
  async getSystemStatus() {
    return {
      configured: this.hasuraSystemService.isConfigured(),
      hasuraUrl: this.hasuraSystemService.getHasuraUrl(),
    };
  }

  @Post('user/create')
  async createUser(
    @Body()
    userData: {
      email: string;
      first_name: string;
      last_name: string;
      user_type_id: string;
    }
  ) {
    try {
      const user = await this.hasuraUserService.createUser(userData);
      return {
        success: true,
        user,
        identifier: this.hasuraUserService.getIdentifier(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('user/create_with_client')
  async createUserWithClient(
    @Body()
    userData: {
      email: string;
      first_name: string;
      last_name: string;
      user_type_id: string;
    }
  ) {
    try {
      const result = await this.hasuraUserService.createUserWithClient(
        userData
      );
      return {
        success: true,
        user: result.user,
        client: result.client,
        identifier: this.hasuraUserService.getIdentifier(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('user/create_with_agent')
  async createUserWithAgent(
    @Body()
    data: {
      user: {
        email: string;
        first_name: string;
        last_name: string;
        user_type_id: string;
      };
      agent: {
        vehicle_type_id: string;
      };
    }
  ) {
    try {
      const result = await this.hasuraUserService.createUserWithAgent(
        data.user,
        data.agent
      );
      return {
        success: true,
        user: result.user,
        agent: result.agent,
        identifier: this.hasuraUserService.getIdentifier(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('user/create_with_business')
  async createUserWithBusiness(
    @Body()
    data: {
      user: {
        email: string;
        first_name: string;
        last_name: string;
        user_type_id: string;
      };
      business: {
        name: string;
      };
    }
  ) {
    try {
      const result = await this.hasuraUserService.createUserWithBusiness(
        data.user,
        data.business
      );
      return {
        success: true,
        user: result.user,
        business: result.business,
        identifier: this.hasuraUserService.getIdentifier(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('user/status')
  async getUserStatus() {
    return {
      configured: this.hasuraUserService.isConfigured(),
      identifier: this.hasuraUserService.getIdentifier(),
    };
  }
}
