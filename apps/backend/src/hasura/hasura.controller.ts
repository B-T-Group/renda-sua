import { Body, Controller, Get, Post } from '@nestjs/common';
import { HasuraSystemService } from './hasura-system.service';
import { HasuraUserService } from './hasura-user.service';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';

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
    @ReqContext() ctx: RequestContext,
    @Body()
    userData: {
      email: string;
      first_name: string;
      last_name: string;
      user_type_id: string;
    }
  ) {
    try {
      const user = await this.hasuraSystemService.createUser(userData);
      return {
        success: true,
        user,
        userId: this.hasuraUserService.getUserId(ctx),
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
    @ReqContext() ctx: RequestContext,
    @Body()
    userData: {
      email: string;
      first_name: string;
      last_name: string;
      user_type_id: string;
    }
  ) {
    try {
      const result = await this.hasuraSystemService.createUserWithClient(
        userData
      );
      return {
        success: true,
        user: result.user,
        client: result.client,
        userId: this.hasuraUserService.getUserId(ctx),
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
    @ReqContext() ctx: RequestContext,
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
      const result = await this.hasuraSystemService.createUserWithAgent(
        data.user,
        data.agent
      );
      return {
        success: true,
        user: result.user,
        agent: result.agent,
        userId: this.hasuraUserService.getUserId(ctx),
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
    @ReqContext() ctx: RequestContext,
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
        main_interest?: 'sell_items' | 'rent_items';
      };
    }
  ) {
    try {
      const result = await this.hasuraSystemService.createUserWithBusiness(
        data.user,
        {
          name: data.business.name,
          main_interest: data.business.main_interest ?? 'sell_items',
        }
      );
      return {
        success: true,
        user: result.user,
        business: result.business,
        userId: this.hasuraUserService.getUserId(ctx),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('user/status')
  async getUserStatus(@ReqContext() ctx: RequestContext) {
    return {
      configured: this.hasuraUserService.isConfigured(ctx),
      userId: this.hasuraUserService.getUserId(ctx),
    };
  }
}
