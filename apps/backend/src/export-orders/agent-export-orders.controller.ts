import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { ExportOrdersService } from './export-orders.service';

@ApiTags('agent-export-orders')
@Controller('agent/export-orders')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AgentExportOrdersController {
  constructor(
    private readonly exportOrders: ExportOrdersService,
    private readonly hasuraUser: HasuraUserService,
    private readonly hasura: HasuraSystemService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List export orders for agent clients' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    const data = await this.exportOrders.listForActor({
      role: 'agent',
      page,
      limit,
    });
    return { success: true, data };
  }

  @Get('commissions')
  @ApiOperation({ summary: 'Agent export commissions summary' })
  async commissions() {
    const user = await this.hasuraUser.getUser();
    const res = await this.hasura.executeQuery<{
      export_commissions: Array<{
        id: string;
        amount: number;
        status: string;
        export_order_id: string;
        created_at: string;
      }>;
    }>(
      `query AgentExportCommissions($uid: uuid!) {
        export_commissions(
          where: { agent_user_id: { _eq: $uid } }
          order_by: { created_at: desc }
          limit: 200
        ) {
          id amount status export_order_id created_at
        }
      }`,
      { uid: user.id }
    );
    const items = res.export_commissions ?? [];
    const accrued = items
      .filter((i) => i.status === 'accrued')
      .reduce((s, i) => s + Number(i.amount), 0);
    const payable = items
      .filter((i) => i.status === 'payable')
      .reduce((s, i) => s + Number(i.amount), 0);
    const paid = items
      .filter((i) => i.status === 'paid')
      .reduce((s, i) => s + Number(i.amount), 0);
    return { success: true, data: { items, accrued, payable, paid } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Agent export order detail' })
  async detail(@Param('id') id: string) {
    const data = await this.exportOrders.getById(id);
    return { success: true, data };
  }
}
