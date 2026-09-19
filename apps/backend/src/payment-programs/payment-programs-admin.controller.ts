import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { CashAdvanceService } from './cash-advance.service';
import { PartnerBusinessesService } from './partner-businesses.service';
import { PaymentScheduleCatalogService } from './payment-schedule-catalog.service';
import {
  AssignScheduleDto,
  CreateCashAdvanceProgramDto,
  CreateScheduleDto,
  GrantCreditDto,
  OpenFacilityDto,
  PartnerBusinessDto,
  SetStatusDto,
} from './payment-programs.dto';
import { PurchaseCreditsService } from './purchase-credits.service';

const PIPE = new ValidationPipe({ transform: true, whitelist: true });

@ApiTags('admin-payment-programs')
@Controller('admin/payment-programs')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.PAYMENT_PROGRAMS)
@ApiBearerAuth()
@UsePipes(PIPE)
export class PaymentProgramsAdminController {
  constructor(
    private readonly schedules: PaymentScheduleCatalogService,
    private readonly cashAdvances: CashAdvanceService,
    private readonly credits: PurchaseCreditsService,
    private readonly partners: PartnerBusinessesService,
    private readonly users: HasuraUserService
  ) {}

  @Get('schedules')
  @ApiOperation({ summary: 'List payment schedules and assignments' })
  listSchedules() {
    return this.schedules.listSchedules();
  }

  @Get('agents')
  @ApiOperation({ summary: 'Search agents by name, email, or referral code' })
  @ApiQuery({ name: 'search', required: false })
  searchAgents(@Query('search') search = '') {
    return this.schedules.searchAgents(search);
  }

  @Post('schedules')
  @ApiOperation({ summary: 'Create a named payment schedule' })
  async createSchedule(@Body() dto: CreateScheduleDto) {
    return this.schedules.createSchedule({ ...dto, createdBy: await this.actorId() });
  }

  @Post('schedules/:id/assignments')
  @ApiOperation({ summary: 'Apply a payment schedule to an agent' })
  async assign(@Param('id') id: string, @Body() dto: AssignScheduleDto) {
    return this.schedules.assign({
      scheduleId: id,
      agentId: dto.agentId,
      amount: dto.amount,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      createdBy: await this.actorId(),
    });
  }

  @Patch('assignments/:id')
  @ApiOperation({ summary: 'Pause, end, or reactivate a schedule assignment' })
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.schedules.setAssignmentStatus(id, dto.status);
  }

  @Get('cash-advances')
  @ApiOperation({ summary: 'List cash-advance programs' })
  listPrograms() {
    return this.cashAdvances.listPrograms();
  }

  @Post('cash-advances')
  @ApiOperation({ summary: 'Create a cash-advance program' })
  async createProgram(@Body() dto: CreateCashAdvanceProgramDto) {
    return this.cashAdvances.createProgram({
      name: dto.name,
      currency: dto.currency,
      defaultLimit: dto.defaultLimit,
      createdBy: await this.actorId(),
    });
  }

  @Post('cash-advances/:id/facilities')
  @ApiOperation({ summary: 'Open a cash-advance facility for a user' })
  async openFacility(@Param('id') id: string, @Body() dto: OpenFacilityDto) {
    const programs = await this.cashAdvances.listPrograms();
    const program = programs.find((row: { id: string; name: string }) => row.id === id);
    return this.cashAdvances.openFacility({
      programId: id,
      programName: program?.name ?? 'Cash advance',
      userId: dto.userId,
      currency: dto.currency,
      limitAmount: dto.limitAmount,
      endsAt: dto.endsAt,
      createdBy: await this.actorId(),
      preferredLanguage: dto.preferredLanguage,
    });
  }

  @Post('credits')
  @ApiOperation({ summary: 'Grant scoped purchase credits to a client' })
  async grant(@Body() dto: GrantCreditDto) {
    return this.credits.grant({ ...dto, createdBy: await this.actorId() });
  }

  @Get('clients')
  @ApiOperation({ summary: 'Search clients by name, email, or phone number' })
  @ApiQuery({ name: 'search', required: false })
  searchClients(@Query('search') search = '') {
    return this.credits.searchClients(search);
  }

  @Get('businesses')
  @ApiOperation({ summary: 'Search businesses by name, email, or referral code' })
  @ApiQuery({ name: 'search', required: false })
  searchBusinesses(@Query('search') search = '') {
    return this.partners.search(search);
  }

  @Get('partners')
  @ApiOperation({ summary: 'List Rendasua partner businesses' })
  listPartners() {
    return this.partners.list();
  }

  @Post('partners')
  @ApiOperation({ summary: 'Mark or unmark a business as a Rendasua partner' })
  async setPartner(@Body() dto: PartnerBusinessDto) {
    return this.partners.set({ ...dto, createdBy: await this.actorId() });
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
