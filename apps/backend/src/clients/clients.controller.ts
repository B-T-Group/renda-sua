import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('nearby-agents')
  @ApiOperation({
    summary:
      'Count of available delivery agents near the authenticated client (top 10 closest in the same region)',
  })
  @ApiResponse({
    status: 200,
    description: 'Number of nearby available agents',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number', example: 7 },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Caller is not an active client',
  })
  async getNearbyAgents(): Promise<{ count: number }> {
    return this.clientsService.getNearbyAgentsCount();
  }
}
