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
  SetActiveDto,
  SetStatusDto,
  UpdateAssignmentTermsDto,
  UpdateCashAdvanceProgramDto,
  UpdateFacilityDto,
  UpdateGrantDto,
  UpdateScheduleDto,
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

  @Patch('schedules/:id')
  @ApiOperation({ summary: 'Edit a schedule template. Currency stays fixed.' })
  updateSchedule(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.schedules.updateSchedule(id, dto);
  }

  @Post('schedules/:id/active')
  @ApiOperation({ summary: 'Deactivate or reactivate a schedule. Deactivate ends assignments.' })
  setScheduleActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.schedules.setScheduleActive(id, dto.isActive);
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

  @Patch('assignments/:id/terms')
  @ApiOperation({ summary: 'Edit assignment amount or end date while active or paused' })
  updateAssignment(@Param('id') id: string, @Body() dto: UpdateAssignmentTermsDto) {
    return this.schedules.updateAssignment(id, dto);
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

  @Patch('cash-advances/:id')
  @ApiOperation({ summary: 'Edit a cash-advance program name and default limit' })
  updateProgram(@Param('id') id: string, @Body() dto: UpdateCashAdvanceProgramDto) {
    return this.cashAdvances.updateProgram(id, dto);
  }

  @Post('cash-advances/:id/active')
  @ApiOperation({ summary: 'Deactivate or reactivate a cash-advance program' })
  setProgramActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.cashAdvances.setProgramActive(id, dto.isActive);
  }

  @Patch('cash-advances/facilities/:id')
  @ApiOperation({ summary: 'Edit a facility limit or end date. Limit cannot drop below drawn debt.' })
  updateFacility(@Param('id') id: string, @Body() dto: UpdateFacilityDto) {
    return this.cashAdvances.updateFacility(id, dto);
  }

  @Post('cash-advances/facilities/:id/close')
  @ApiOperation({ summary: 'Close a facility without forgiving outstanding debt' })
  closeFacility(@Param('id') id: string) {
    return this.cashAdvances.closeFacility(id);
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

  @Get('credits')
  @ApiOperation({ summary: 'List purchase credit grants' })
  listCredits() {
    return this.credits.listAll();
  }

  @Post('credits')
  @ApiOperation({ summary: 'Grant scoped purchase credits to a client' })
  async grant(@Body() dto: GrantCreditDto) {
    return this.credits.grant({ ...dto, createdBy: await this.actorId() });
  }

  @Patch('credits/:id')
  @ApiOperation({ summary: 'Edit a grant expiry or memo. Amount and scope stay fixed.' })
  updateGrant(@Param('id') id: string, @Body() dto: UpdateGrantDto) {
    return this.credits.updateGrant(id, dto);
  }

  @Post('credits/:id/revoke')
  @ApiOperation({ summary: 'Revoke a grant and zero its remaining balance' })
  revokeGrant(@Param('id') id: string) {
    return this.credits.revoke(id);
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
