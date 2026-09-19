import { Body, Controller, Get, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CashAdvanceService } from './cash-advance.service';
import { DrawCashAdvanceDto } from './payment-programs.dto';
import { PaymentScheduleCatalogService } from './payment-schedule-catalog.service';
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
    private readonly schedules: PaymentScheduleCatalogService
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

  @Post('cash-advance/draw')
  @ApiOperation({ summary: 'Draw on an active cash-advance facility into available balance' })
  async draw(@Body() dto: DrawCashAdvanceDto) {
    const user = await this.users.getUser();
    return this.cashAdvances.draw(user.id, dto.amount, dto.currency);
  }
}
