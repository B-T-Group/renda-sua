import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { HasuraSystemService } from './hasura-system.service';
import { HasuraUserService } from './hasura-user.service';

// Note: In a real application, you would implement proper JWT authentication guards
// For now, this is a simplified example

@Controller('hasura')
export class HasuraController {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
  ) {}

  @Get('system/status')
  async getSystemStatus() {
    return {
      configured: this.hasuraSystemService.isConfigured(),
      hasuraUrl: this.hasuraSystemService.getHasuraUrl(),
    };
  }

  @Post('user/create')
  async createUser(@Body() userData: { email: string; name?: string }) {
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

  @Post('user/create-client')
  async createClient(@Body() clientData: { name: string; user_id: string }) {
    try {
      const client = await this.hasuraUserService.createClientRecord(clientData);
      return {
        success: true,
        client,
        identifier: this.hasuraUserService.getIdentifier(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('user/create-agent')
  async createAgent(@Body() agentData: { name: string; user_id: string; license_number: string }) {
    try {
      const agent = await this.hasuraUserService.createAgentRecord(agentData);
      return {
        success: true,
        agent,
        identifier: this.hasuraUserService.getIdentifier(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('user/create-business')
  async createBusiness(@Body() businessData: { 
    name: string; 
    user_id: string; 
    business_type: string; 
    registration_number: string 
  }) {
    try {
      const business = await this.hasuraUserService.createBusinessRecord(businessData);
      return {
        success: true,
        business,
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