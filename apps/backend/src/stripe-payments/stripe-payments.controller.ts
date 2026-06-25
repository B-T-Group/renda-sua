import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { Public } from '../auth/public.decorator';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { InitiateStripePaymentDto } from './dto/initiate-stripe-payment.dto';
import { WithdrawStripeDto } from './dto/withdraw-stripe.dto';
import { StripeCheckoutService } from './stripe-checkout.service';
import { StripeConnectService } from './stripe-connect.service';
import { StripePaymentCallbackProcessor } from './stripe-payment-callback.processor';
import { StripePaymentsDatabaseService } from './stripe-payments-database.service';
import { StripePayoutService } from './stripe-payout.service';
import { StripeService } from './stripe.service';

@ApiTags('stripe-payments')
@Controller('stripe-payments')
@Throttle({ short: { limit: 20, ttl: 60000 } })
export class StripePaymentsController {
  private readonly logger = new Logger(StripePaymentsController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly databaseService: StripePaymentsDatabaseService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly callbackProcessor: StripePaymentCallbackProcessor,
    private readonly connectService: StripeConnectService,
    private readonly payoutService: StripePayoutService,
    private readonly checkoutService: StripeCheckoutService
  ) {}

  @Post('initiate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Stripe hosted Checkout session' })
  @ApiBody({ type: InitiateStripePaymentDto })
  @ApiResponse({ status: 201, description: 'Checkout session created' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @HttpCode(HttpStatus.CREATED)
  async initiate(@Body() body: InitiateStripePaymentDto) {
    try {
      const email = body.customerEmail || (await this.resolveUserEmail());
      const result = await this.checkoutService.createCheckout({
        amount: body.amount,
        currency: body.currency,
        description: body.description,
        customerEmail: email,
        accountId: body.accountId,
        paymentEntity: body.paymentEntity,
        entityId: body.entityId,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
      });

      return { success: true, data: result };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to initiate Stripe payment: ${error.message}`);
      throw new HttpException(
        { success: false, message: 'Failed to initiate Stripe payment' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('withdraw')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Withdraw wallet funds to the Connect account' })
  @ApiBody({ type: WithdrawStripeDto })
  @ApiResponse({ status: 201, description: 'Payout initiated' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @HttpCode(HttpStatus.CREATED)
  async withdraw(@Body() body: WithdrawStripeDto) {
    const user = await this.hasuraUserService.getUser();
    const result = await this.payoutService.executePayout(
      {
        amount: body.amount,
        currency: body.currency,
        accountId: body.accountId,
        userId: user.id,
        description: body.description || 'Wallet withdrawal',
      },
      { throwOnFailure: true }
    );
    return { success: result.success, data: result.data };
  }

  private async resolveUserEmail(): Promise<string | undefined> {
    try {
      const user = await this.hasuraUserService.getUser();
      return user.email ?? undefined;
    } catch {
      return undefined;
    }
  }

  @Get('transactions/:id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a Stripe transaction status (live sync)' })
  async getStatus(@Param('id') id: string) {
    const tx = await this.databaseService.getTransactionById(id);
    if (!tx) {
      throw new HttpException(
        { success: false, message: 'Transaction not found' },
        HttpStatus.NOT_FOUND
      );
    }
    let status = tx.status;
    if (status === 'pending' && tx.stripe_session_id) {
      const session = await this.stripeService.retrieveCheckoutSession(
        tx.stripe_session_id
      );
      if (session.payment_status === 'paid') status = 'success';
      else if (session.status === 'expired') status = 'cancelled';
    }
    return {
      success: true,
      data: { transactionId: tx.id, reference: tx.reference, status },
    };
  }

  @Post('transactions/:id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a pending Stripe checkout session' })
  async cancel(@Param('id') id: string) {
    const tx = await this.databaseService.getTransactionById(id);
    if (!tx) {
      throw new HttpException(
        { success: false, message: 'Transaction not found' },
        HttpStatus.NOT_FOUND
      );
    }
    if (tx.status !== 'pending') {
      return { success: true, data: { status: tx.status } };
    }
    if (tx.stripe_session_id) {
      await this.stripeService.expireCheckoutSession(tx.stripe_session_id);
    }
    await this.databaseService.updateTransaction(tx.id, {
      status: 'cancelled',
    });
    return { success: true, data: { status: 'cancelled' } };
  }

  @Get('transactions/reference/:reference')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a Stripe transaction by reference' })
  async getByReference(@Param('reference') reference: string) {
    const tx = await this.databaseService.getTransactionByReference(reference);
    if (!tx) {
      throw new HttpException(
        { success: false, message: 'Transaction not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return { success: true, data: tx };
  }

  @Get('transactions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a Stripe transaction by id' })
  async getById(@Param('id') id: string) {
    const tx = await this.databaseService.getTransactionById(id);
    if (!tx) {
      throw new HttpException(
        { success: false, message: 'Transaction not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return { success: true, data: tx };
  }

  @Get('transactions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List Stripe transactions' })
  async list(
    @Query('accountId') accountId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const data = await this.databaseService.listTransactions({
      accountId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return { success: true, data };
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe payments webhook' })
  async webhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request
  ) {
    const event = this.verifyEvent(req, signature, 'payments');
    const isNew = await this.databaseService.recordEvent(
      event.id,
      event.type,
      'payments',
      event as unknown
    );
    if (!isNew) {
      return { received: true, duplicate: true };
    }
    await this.dispatchPaymentEvent(event, req);
    await this.databaseService.markEventProcessed(event.id);
    return { received: true };
  }

  private verifyEvent(
    req: Request,
    signature: string,
    source: 'payments' | 'connect'
  ): Stripe.Event {
    try {
      return this.stripeService.constructEvent(
        (req as unknown as { body: Buffer }).body,
        signature,
        source
      );
    } catch (error: any) {
      this.logger.error(`Stripe signature verification failed: ${error.message}`);
      throw new HttpException(
        { received: false, message: 'Invalid signature' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async dispatchPaymentEvent(
    event: Stripe.Event,
    req: Request
  ): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.callbackProcessor.onCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          req
        );
        break;
      case 'checkout.session.expired':
        await this.callbackProcessor.onSessionExpired(
          event.data.object as Stripe.Checkout.Session,
          req
        );
        break;
      case 'payment_intent.payment_failed':
        await this.callbackProcessor.onPaymentFailed(
          event.data.object as Stripe.PaymentIntent,
          req
        );
        break;
      case 'charge.refunded':
        await this.callbackProcessor.onChargeRefunded(
          event.data.object as Stripe.Charge
        );
        break;
      case 'charge.dispute.created':
        await this.callbackProcessor.onDisputeCreated(
          event.data.object as Stripe.Dispute
        );
        break;
      default:
        this.logger.debug(`Unhandled Stripe payment event: ${event.type}`);
    }
  }

  @Public()
  @Post('connect/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe Connect account webhook' })
  async connectWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request
  ) {
    const event = this.verifyEvent(req, signature, 'connect');
    const isNew = await this.databaseService.recordEvent(
      event.id,
      event.type,
      'connect',
      event as unknown
    );
    if (!isNew) {
      return { received: true, duplicate: true };
    }
    const accountId = this.extractConnectAccountId(event);
    if (accountId) {
      await this.connectService.syncFromStripe(accountId);
    } else {
      this.logger.debug(`Unhandled Stripe connect event: ${event.type}`);
    }
    await this.databaseService.markEventProcessed(event.id);
    return { received: true };
  }

  /**
   * Resolve the connected account id from either the classic v1
   * `account.updated` event (`data.object`) or a v2 "thin" account event
   * (`v2.core.account[...]`), which carries the account in `related_object`.
   */
  private extractConnectAccountId(event: Stripe.Event): string | null {
    if (event.type === 'account.updated') {
      return (event.data?.object as Stripe.Account)?.id ?? null;
    }
    const related = (
      event as unknown as {
        related_object?: { id?: string; type?: string };
      }
    ).related_object;
    return related?.id?.startsWith('acct_') ? related.id : null;
  }
}
