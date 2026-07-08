import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { BusinessContractsService } from './business-contracts.service';

@ApiTags('business-contracts')
@Controller('business-contracts')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@Throttle({ short: { limit: 20, ttl: 60000 } })
export class BusinessContractsController {
  constructor(
    private readonly contractsService: BusinessContractsService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current merchant contract status' })
  @ApiResponse({ status: 200, description: 'Contract status' })
  async getStatus() {
    const businessId = await this.requireBusinessId();
    const data = await this.contractsService.getContractStatus(businessId);
    return { success: true, data };
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend or remind merchant contract' })
  async resend() {
    const businessId = await this.requireBusinessId();
    const data = await this.contractsService.resendContract(businessId);
    return { success: true, data };
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download signed contract PDF' })
  async download(@Param('id') id: string) {
    const businessId = await this.requireBusinessId();
    const url = await this.contractsService.getDownloadUrl(id, businessId, 'pdf');
    return { success: true, data: { url } };
  }

  @Get(':id/audit-certificate')
  @ApiOperation({ summary: 'Download contract audit certificate' })
  async auditCertificate(@Param('id') id: string) {
    const businessId = await this.requireBusinessId();
    const url = await this.contractsService.getDownloadUrl(
      id,
      businessId,
      'audit'
    );
    return { success: true, data: { url } };
  }

  private async requireBusinessId(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    const businessId = user?.business?.id;
    if (!businessId) {
      throw new HttpException(
        { success: false, message: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    return businessId;
  }
}
