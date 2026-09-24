import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CashAdvanceService } from './cash-advance.service';
import {
  DrawCashAdvanceDto,
  RejectScheduleAssignmentDto,
} from './payment-programs.dto';
import { PaymentScheduleCatalogService } from './payment-schedule-catalog.service';
import { PaymentScheduleConsentService } from './payment-schedule-consent.service';
import { PurchaseCreditsService } from './purchase-credits.service';

@ApiTags('payment-programs')
@Controller('payment-programs')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class PaymentProgramsUserController {
  constructor(
    private readonly users: HasuraUserService,
    private readonly cashAdvances: CashAdvanceService,
    private readonly credits: PurchaseCreditsService,
    private readonly schedules: PaymentScheduleCatalogService,
    private readonly consent: PaymentScheduleConsentService
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Cash advance, purchase credits, and schedule activity for the current user' })
  async me(): Promise<{
    facilities: unknown[];
    grants: unknown[];
    assignments: unknown[];
  }> {
    const user = await this.users.getUser();
    const [facilities, grants, assignments] = await Promise.all([
      this.cashAdvances.listForUser(user.id),
      this.credits.listForUser(user.id),
      this.schedules.listForAgentUser(user.id),
    ]);
    return { facilities, grants, assignments };
  }

  @Get('schedules/:assignmentId')
  @ApiOperation({ summary: 'Payment schedule assignment detail with objectives and progress' })
  async assignmentDetail(@Param('assignmentId') assignmentId: string) {
    const user = await this.users.getUser();
    return this.consent.getDetailForAgent(assignmentId, user.id);
  }

  @Post('schedules/:assignmentId/defer')
  @ApiOperation({ summary: 'Defer a payment schedule offer' })
  async defer(@Param('assignmentId') assignmentId: string) {
    const user = await this.users.getUser();
    return this.consent.defer(assignmentId, user.id);
  }

  @Post('schedules/:assignmentId/accept')
  @ApiOperation({ summary: 'Accept a payment schedule offer' })
  async accept(@Param('assignmentId') assignmentId: string) {
    const user = await this.users.getUser();
    return this.consent.accept(assignmentId, user.id);
  }

  @Post('schedules/:assignmentId/reject')
  @ApiOperation({ summary: 'Reject a payment schedule offer with a reason' })
  async reject(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: RejectScheduleAssignmentDto
  ) {
    const user = await this.users.getUser();
    return this.consent.reject(assignmentId, user.id, dto.reason, dto.note);
  }

  @Post('cash-advance/draw')
  @ApiOperation({ summary: 'Draw on an active cash-advance facility into available balance' })
  async draw(@Body() dto: DrawCashAdvanceDto) {
    const user = await this.users.getUser();
    return this.cashAdvances.draw(user.id, dto.amount, dto.currency);
  }
}
