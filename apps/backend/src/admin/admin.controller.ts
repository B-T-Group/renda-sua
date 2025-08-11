import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { BusinessAdminGuard } from './business-admin.guard';

@Controller('admin')
@UseGuards(BusinessAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('agents')
  async getAgents() {
    const agents = await this.adminService.getAgentsWithDetails();
    return { success: true, agents };
  }

  @Get('clients')
  async getClients() {
    const clients = await this.adminService.getClientsWithDetails();
    return { success: true, clients };
  }

  @Get('businesses')
  async getBusinesses() {
    const businesses = await this.adminService.getBusinessesWithDetails();
    return { success: true, businesses };
  }

  @Patch('agents/:id')
  async patchAgent(
    @Param('id') id: string,
    @Body()
    body: {
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      is_verified?: boolean;
      vehicle_type_id?: string;
      [key: string]: unknown;
    }
  ) {
    const { userUpdates, agentUpdates } = this.splitAgentUpdates(body);
    if (
      Object.keys(userUpdates).length === 0 &&
      Object.keys(agentUpdates).length === 0
    ) {
      throw new BadRequestException('No valid fields to update');
    }
    const result = await this.adminService.updateAgent(
      id,
      userUpdates,
      agentUpdates
    );
    return { success: true, ...result };
  }

  @Patch('clients/:id')
  async patchClient(
    @Param('id') id: string,
    @Body()
    body: {
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      [key: string]: unknown;
    }
  ) {
    const updates = this.pickAllowed(body);
    const user = await this.adminService.updateClientUser(id, updates);
    return { success: true, user };
  }

  @Patch('businesses/:id')
  async patchBusiness(
    @Param('id') id: string,
    @Body()
    body: {
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      name?: string;
      is_admin?: boolean;
      [key: string]: unknown;
    }
  ) {
    const { userUpdates, businessUpdates } = this.splitBusinessUpdates(body);
    if (
      Object.keys(userUpdates).length === 0 &&
      Object.keys(businessUpdates).length === 0
    ) {
      throw new BadRequestException('No valid fields to update');
    }
    const result = await this.adminService.updateBusiness(
      id,
      userUpdates,
      businessUpdates
    );
    return { success: true, ...result };
  }

  private pickAllowed(body: Record<string, unknown>) {
    const allowed: any = {};
    if (typeof body.first_name === 'string')
      allowed.first_name = body.first_name;
    if (typeof body.last_name === 'string') allowed.last_name = body.last_name;
    if (typeof body.phone_number === 'string')
      allowed.phone_number = body.phone_number;
    if (Object.keys(allowed).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }
    return allowed;
  }

  private splitAgentUpdates(body: Record<string, unknown>) {
    const userUpdates = this.pickAllowed(body);
    const agentUpdates: any = {};
    if (typeof body.is_verified === 'boolean')
      agentUpdates.is_verified = body.is_verified;
    if (typeof body.vehicle_type_id === 'string')
      agentUpdates.vehicle_type_id = body.vehicle_type_id;
    return { userUpdates, agentUpdates };
  }

  private splitBusinessUpdates(body: Record<string, unknown>) {
    const userUpdates = this.pickAllowed(body);
    const businessUpdates: any = {};
    if (typeof body.name === 'string') businessUpdates.name = body.name;
    if (typeof body.is_admin === 'boolean')
      businessUpdates.is_admin = body.is_admin;
    return { userUpdates, businessUpdates };
  }
}
