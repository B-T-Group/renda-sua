import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  AttachAgentMobilePaymentPhoneDto,
  CreateMobilePaymentPhoneDto,
  UpdateMobilePaymentPhoneDto,
} from './mobile-payment-phones.dto';
import { MobilePaymentPhonesService } from './mobile-payment-phones.service';

@ApiTags('mobile-payment-phones')
@Controller('mobile-payment-phones')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class MobilePaymentPhonesController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly mobilePaymentPhonesService: MobilePaymentPhonesService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List mobile payment phones for the current user' })
  async list(@ReqContext() ctx: RequestContext) {
    const userId = this.hasuraUserService.getUserId(ctx);
    const phones = await this.mobilePaymentPhonesService.listForUser(userId);
    return { success: true, data: { phones } };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an unverified mobile payment phone' })
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateMobilePaymentPhoneDto
  ) {
    const userId = this.hasuraUserService.getUserId(ctx);
    const phone = await this.mobilePaymentPhonesService.createForUser(
      userId,
      body.countryCode,
      body.phoneNumber
    );
    return { success: true, data: { phone } };
  }

  @Post('agent/attach')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attach a mobile payment phone to the agent profile' })
  async attachAgent(
    @ReqContext() ctx: RequestContext,
    @Body() body: AttachAgentMobilePaymentPhoneDto
  ) {
    const userId = this.hasuraUserService.getUserId(ctx);
    await this.mobilePaymentPhonesService.attachAgentPhone(
      userId,
      body.mobilePaymentPhoneId
    );
    return { success: true };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get mobile payment phone and verification status' })
  @ApiParam({ name: 'id', type: String })
  async getOne(@ReqContext() ctx: RequestContext, @Param('id') id: string) {
    const userId = this.hasuraUserService.getUserId(ctx);
    const status = await this.mobilePaymentPhonesService.getVerificationStatus(
      userId,
      id
    );
    return { success: true, data: status };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit mobile payment phone (clears verification)',
  })
  @ApiParam({ name: 'id', type: String })
  async update(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateMobilePaymentPhoneDto
  ) {
    const userId = this.hasuraUserService.getUserId(ctx);
    const phone = await this.mobilePaymentPhonesService.updateForUser(
      userId,
      id,
      body.countryCode,
      body.phoneNumber
    );
    return { success: true, data: { phone } };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Unlink phone from locations and agent profile, then delete the registry row',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Phone unlinked and deleted' })
  @ApiResponse({ status: 404, description: 'Phone not found' })
  async remove(@ReqContext() ctx: RequestContext, @Param('id') id: string) {
    const userId = this.hasuraUserService.getUserId(ctx);
    await this.mobilePaymentPhonesService.deleteForUser(userId, id);
    return { success: true };
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start 150 XAF mobile-money verification (refunded after success)',
  })
  @ApiParam({ name: 'id', type: String })
  async verify(@ReqContext() ctx: RequestContext, @Param('id') id: string) {
    const userId = this.hasuraUserService.getUserId(ctx);
    const result = await this.mobilePaymentPhonesService.initiateVerification(
      userId,
      id
    );
    return { success: true, data: result };
  }
}
