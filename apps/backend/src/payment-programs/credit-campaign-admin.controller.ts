import { Body, Controller, Get, Param, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { CreditCampaignService } from './credit-campaign.service';
import { CreateCampaignDto, SetActiveDto } from './payment-programs.dto';

const PIPE = new ValidationPipe({ transform: true, whitelist: true });

@ApiTags('admin-payment-programs')
@Controller('admin/payment-programs/campaigns')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.PAYMENT_PROGRAMS)
@ApiBearerAuth()
@UsePipes(PIPE)
export class CreditCampaignAdminController {
  constructor(
    private readonly campaigns: CreditCampaignService,
    private readonly users: HasuraUserService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List credit campaigns' })
  list() {
    return this.campaigns.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a signup credit campaign' })
  async create(@Body() dto: CreateCampaignDto) {
    return this.campaigns.create({ ...dto, createdBy: await this.actorId() });
  }

  @Post(':id/active')
  @ApiOperation({ summary: 'Activate or deactivate a credit campaign' })
  setActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.campaigns.setActive(id, dto.isActive);
  }

  private async actorId(): Promise<string | null> {
    try {
      const user = await this.users.getUser();
      return user?.id ?? null;
    } catch {
      return null;
    }
  }
}
