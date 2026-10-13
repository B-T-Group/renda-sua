import {
  CanActivate,
  Controller,
  ForbiddenException,
  HttpCode,
  Injectable,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { isProductionRuntime } from '../auth/test-user-bypass.util';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { RbacService } from '../rbac/rbac.service';
import { RepresentativeCommissionService } from './representative-commission.service';

/** Hides the route entirely in production runtime. */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  canActivate(): boolean {
    if (isProductionRuntime()) throw new NotFoundException();
    return true;
  }
}

/**
 * DEV-only manual trigger for the representative-commission month close, so QA
 * can test flag gating and double / parallel close without waiting for the
 * 10th-of-month cron. Superuser only. Returns 404 whenever the process runs as
 * production (NODE_ENV or DEPLOYMENT_ENV), before any auth or DB work.
 */
@ApiTags('admin-portfolio')
@Controller('admin/portfolio')
@ApiBearerAuth()
export class RepresentativeCommissionAdminController {
  constructor(
    private readonly commissions: RepresentativeCommissionService,
    private readonly users: HasuraUserService,
    private readonly rbac: RbacService
  ) {}

  @Post('close')
  @HttpCode(200)
  @UseGuards(DevOnlyGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'DEV only: run the portfolio month close now (superuser)' })
  @ApiQuery({ name: 'period', required: false, example: '2026-09' })
  async close(@Query('period') period?: string) {
    await this.assertSuperuser();
    return this.commissions.closeMonthForAdmin(period || undefined);
  }

  private async assertSuperuser(): Promise<void> {
    const user = await this.users.getUser();
    const access = user?.id ? await this.rbac.getEffectiveAccess(user.id) : null;
    if (!access?.isSuperuser) {
      throw new ForbiddenException('Superuser only');
    }
  }
}
