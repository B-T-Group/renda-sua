import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  StockAvailabilityService,
  type RespondAction,
} from './stock-availability.service';

class RespondStockAvailabilityDto {
  action!: RespondAction;
  quantity?: number;
}

@ApiTags('Inventory Items')
@Controller('inventory-items')
@ApiBearerAuth()
export class StockAvailabilityController {
  constructor(private readonly stockAvailabilityService: StockAvailabilityService) {}

  @Post(':inventoryId/availability-check')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Client: request stock availability confirmation from the store (low stock only)',
  })
  @ApiParam({ name: 'inventoryId', description: 'Business inventory UUID' })
  @ApiResponse({ status: 201, description: 'Availability check created' })
  @ApiResponse({ status: 400, description: 'Stock not in low-stock range' })
  @ApiResponse({ status: 403, description: 'Clients only' })
  @ApiResponse({ status: 409, description: 'Pending check already exists' })
  @ApiResponse({ status: 429, description: 'Rate limited' })
  async requestCheck(@Param('inventoryId') inventoryId: string) {
    const result = await this.stockAvailabilityService.requestCheck(inventoryId);
    return { success: true, ...result };
  }

  @Get('availability-checks/:messageId')
  @ApiOperation({ summary: 'Business: load a stock availability check for the confirm UI' })
  @ApiParam({ name: 'messageId', description: 'user_messages id' })
  @ApiResponse({ status: 200, description: 'Availability check details' })
  @ApiResponse({ status: 403, description: 'Business only' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getCheck(@Param('messageId') messageId: string) {
    const data = await this.stockAvailabilityService.getCheck(messageId);
    return { success: true, data };
  }

  @Post('availability-checks/:messageId/respond')
  @ApiOperation({
    summary: 'Business: confirm, mark unavailable, or adjust stock for an availability check',
  })
  @ApiParam({ name: 'messageId', description: 'user_messages id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['confirm', 'unavailable', 'adjust'] },
        quantity: { type: 'number', description: 'Required when action is adjust' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Response recorded' })
  @ApiResponse({ status: 403, description: 'Business only' })
  @ApiResponse({ status: 409, description: 'Already answered' })
  async respond(
    @Param('messageId') messageId: string,
    @Body() body: RespondStockAvailabilityDto
  ) {
    const data = await this.stockAvailabilityService.respond(messageId, {
      action: body.action,
      quantity: body.quantity,
    });
    return { success: true, data };
  }
}
