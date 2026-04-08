import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  BulkPaymentStatusDto,
  CashinPayDto,
  CashoutPayDto,
  C2cPayDto,
  Ic2cPayDto,
  MpPayDto,
  SubscriberInfosDto,
} from './dto/orange-momo.dto';
import type { OrangeCollectionRequest, OrangeMomoResult } from './orange-momo.types';
import { OrangeMomoService } from './orange-momo.service';

const okSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: { type: 'object' },
    message: { type: 'string' },
  },
};

@ApiTags('orange-momo')
@Controller('orange-momo')
@Throttle({ short: { limit: 20, ttl: 60000 } })
@ApiBearerAuth()
export class OrangeMomoController {
  private readonly logger = new Logger(OrangeMomoController.name);

  constructor(
    private readonly orangeMomoService: OrangeMomoService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  private unwrap<T>(r: OrangeMomoResult<T>) {
    if (!r.success) {
      throw new BadRequestException(r.error || 'Orange MoMo request failed');
    }
    return { success: true as const, data: r.data, message: r.message };
  }

  @Post('collection/request-to-pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request payment from customer (MTN-style collection)' })
  @ApiBody({ description: 'Collection request (same shape as MTN)' })
  @ApiResponse({ status: 200, description: 'Collection initiated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async requestToPay(@Body() request: OrangeCollectionRequest) {
    try {
      this.logger.log(
        `Orange collection request received: ${JSON.stringify(request)}`
      );
      if (
        !request.amount ||
        !request.currency ||
        !request.externalId ||
        !request.payer
      ) {
        throw new BadRequestException('Missing required fields');
      }
      const user = await this.hasuraUserService.getUser();
      const userId = user.id;
      const result = await this.orangeMomoService.requestToPay(request, userId);
      if (!result.status) {
        throw new BadRequestException(
          result.error || 'Collection request failed'
        );
      }
      return {
        success: true,
        data: result,
        message: 'Collection request initiated successfully',
      };
    } catch (error) {
      this.logger.error(
        `Orange collection request error: ${(error as Error).message}`
      );
      throw error;
    }
  }

  @Get('collection/status/:payToken')
  @ApiOperation({ summary: 'Collection payment status by pay token' })
  @ApiParam({ name: 'payToken', description: 'Pay token (same as transaction id)' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async getCollectionStatus(@Param('payToken') payToken: string) {
    try {
      this.logger.log(`Checking Orange collection status for: ${payToken}`);
      const result = await this.orangeMomoService.getMpPaymentStatus(payToken);
      return {
        success: result.success,
        data: result.data,
        message: result.success
          ? 'Payment status retrieved successfully'
          : 'Payment status check failed',
      };
    } catch (error) {
      this.logger.error(
        `Orange collection status check error: ${(error as Error).message}`
      );
      throw error;
    }
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhookPost(@Body() callbackData: unknown) {
    return this.processOrangeWebhook(callbackData);
  }

  @Public()
  @Put('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhookPut(@Body() callbackData: unknown) {
    return this.processOrangeWebhook(callbackData);
  }

  private async processOrangeWebhook(callbackData: unknown) {
    try {
      this.logger.log(`Orange webhook received: ${JSON.stringify(callbackData)}`);
      await this.orangeMomoService.handleCallback(callbackData);
      return { success: true, message: 'Webhook processed successfully' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Orange webhook processing error: ${msg}`);
      throw error;
    }
  }

  @Post('mp/init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate merchant payment (Orange mp/init)' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async mpInit() {
    return this.unwrap(await this.orangeMomoService.mpInit());
  }

  @Post('mp/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete merchant payment (Orange mp/pay)' })
  @ApiBody({ type: MpPayDto })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async mpPay(@Body() body: MpPayDto) {
    return this.unwrap(await this.orangeMomoService.mpPay(body));
  }

  @Get('mp/paymentstatus/:payToken')
  @ApiOperation({ summary: 'Merchant payment status by pay token' })
  @ApiParam({ name: 'payToken', description: 'Pay token' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async mpPaymentStatus(@Param('payToken') payToken: string) {
    return this.unwrap(await this.orangeMomoService.getMpPaymentStatus(payToken));
  }

  @Get('mp/push/:payToken')
  @ApiOperation({ summary: 'Trigger MP user prompt (Orange mp/push)' })
  @ApiParam({ name: 'payToken', description: 'Pay token' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async mpPush(@Param('payToken') payToken: string) {
    return this.unwrap(await this.orangeMomoService.pushMp(payToken));
  }

  @Post('cashin/init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate cash-in' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async cashinInit() {
    return this.unwrap(await this.orangeMomoService.cashinInit());
  }

  @Post('cashin/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete cash-in' })
  @ApiBody({ type: CashinPayDto })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async cashinPay(@Body() body: CashinPayDto) {
    return this.unwrap(await this.orangeMomoService.cashinPay(body));
  }

  @Get('cashin/paymentstatus/:payToken')
  @ApiOperation({ summary: 'Cash-in status by pay token' })
  @ApiParam({ name: 'payToken', description: 'Pay token' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async cashinPaymentStatus(@Param('payToken') payToken: string) {
    return this.unwrap(
      await this.orangeMomoService.getCashinPaymentStatus(payToken)
    );
  }

  @Post('cashout/init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate cash-out' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async cashoutInit() {
    return this.unwrap(await this.orangeMomoService.cashoutInit());
  }

  @Post('cashout/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete cash-out' })
  @ApiBody({ type: CashoutPayDto })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async cashoutPay(@Body() body: CashoutPayDto) {
    return this.unwrap(await this.orangeMomoService.cashoutPay(body));
  }

  @Get('cashout/paymentstatus/:payToken')
  @ApiOperation({ summary: 'Cash-out status by pay token' })
  @ApiParam({ name: 'payToken', description: 'Pay token' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async cashoutPaymentStatus(@Param('payToken') payToken: string) {
    return this.unwrap(
      await this.orangeMomoService.getCashoutPaymentStatus(payToken)
    );
  }

  @Get('cashout/push/:payToken')
  @ApiOperation({ summary: 'Trigger cash-out user prompt' })
  @ApiParam({ name: 'payToken', description: 'Pay token' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async cashoutPush(@Param('payToken') payToken: string) {
    return this.unwrap(await this.orangeMomoService.pushCashout(payToken));
  }

  @Post('c2c/init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate C2C' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async c2cInit() {
    return this.unwrap(await this.orangeMomoService.c2cInit());
  }

  @Post('c2c/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete C2C payment' })
  @ApiBody({ type: C2cPayDto })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async c2cPay(@Body() body: C2cPayDto) {
    return this.unwrap(await this.orangeMomoService.c2cPay(body));
  }

  @Get('c2c/paymentstatus/:payToken')
  @ApiOperation({ summary: 'C2C status by pay token' })
  @ApiParam({ name: 'payToken', description: 'Pay token' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async c2cPaymentStatus(@Param('payToken') payToken: string) {
    return this.unwrap(await this.orangeMomoService.getC2cPaymentStatus(payToken));
  }

  @Post('ic2c/init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate inverse C2C' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async ic2cInit() {
    return this.unwrap(await this.orangeMomoService.ic2cInit());
  }

  @Post('ic2c/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete inverse C2C payment' })
  @ApiBody({ type: Ic2cPayDto })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async ic2cPay(@Body() body: Ic2cPayDto) {
    return this.unwrap(await this.orangeMomoService.ic2cPay(body));
  }

  @Get('ic2c/paymentstatus/:payToken')
  @ApiOperation({ summary: 'IC2C status by pay token' })
  @ApiParam({ name: 'payToken', description: 'Pay token' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async ic2cPaymentStatus(@Param('payToken') payToken: string) {
    return this.unwrap(
      await this.orangeMomoService.getIc2cPaymentStatus(payToken)
    );
  }

  @Get('ic2c/push/:payToken')
  @ApiOperation({ summary: 'Trigger IC2C user prompt' })
  @ApiParam({ name: 'payToken', description: 'Pay token' })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async ic2cPush(@Param('payToken') payToken: string) {
    return this.unwrap(await this.orangeMomoService.pushIc2c(payToken));
  }

  @Post('transactions/paymentstatus')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk transaction status by pay tokens' })
  @ApiBody({ type: BulkPaymentStatusDto })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async bulkPaymentStatus(@Body() body: BulkPaymentStatusDto) {
    return this.unwrap(
      await this.orangeMomoService.bulkTransactionsPaymentStatus(body)
    );
  }

  @Post('infos/subscriber/:usertype/:msisdn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subscriber first/last name (Orange infos)' })
  @ApiParam({ name: 'usertype', description: 'e.g. customer or channel' })
  @ApiParam({ name: 'msisdn', description: 'Short MSISDN' })
  @ApiBody({ type: SubscriberInfosDto })
  @ApiResponse({ status: 200, description: 'OK', schema: okSchema })
  async subscriberInfos(
    @Param('usertype') usertype: string,
    @Param('msisdn') msisdn: string,
    @Body() body: SubscriberInfosDto
  ) {
    return this.unwrap(
      await this.orangeMomoService.getSubscriberInfos(usertype, msisdn, body)
    );
  }
}
