import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { MobilePaymentsDatabaseService } from '../../mobile-payments/mobile-payments-database.service';
import { MobilePaymentsService } from '../../mobile-payments/mobile-payments.service';
import type { InitiateAccountRechargeDto } from './account-recharge.dto';

const XAF = 'XAF';
const MIN_AMOUNT = 150;
const ALLOWED_COUNTRY_CODES = new Set(['237', '241']);

@Injectable()
export class AccountRechargeService {
  private readonly logger = new Logger(AccountRechargeService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly mobilePaymentsDatabaseService: MobilePaymentsDatabaseService
  ) {}

  async initiateRecharge(dto: InitiateAccountRechargeDto): Promise<{
    transactionId: string;
    providerTransactionId?: string;
    provider?: string;
    message?: string;
  }> {
    this.validateDto(dto);
    const fullPhone = this.buildE164Phone(dto.countryCode, dto.phoneNumber);
    const hqAccount = await this.resolveHqAccount();
    const reference = this.generateReference();
    const description = `HQ account top-up from ${fullPhone}`;
    const provider = this.mobilePaymentsService.getProvider(fullPhone);
    const callbackBase = process.env.API_BASE_URL || 'http://localhost:3000';
    const callbackUrl = `${callbackBase}/mobile-payments/callback/${provider === 'freemopay' ? 'freemopay' : 'mypvit'}`;

    const tx = await this.mobilePaymentsDatabaseService.createTransaction({
      reference,
      amount: dto.amount,
      currency: XAF,
      description,
      provider,
      payment_method: 'mobile_money',
      customer_phone: fullPhone,
      account_id: hqAccount.id,
      transaction_type: 'PAYMENT',
      payment_entity: 'account',
      entity_id: hqAccount.id,
    });

    const paymentResponse = await this.mobilePaymentsService.initiatePayment(
      {
        amount: dto.amount,
        currency: XAF,
        description,
        customerPhone: fullPhone,
        provider,
        ownerCharge: 'MERCHANT',
        transactionType: 'PAYMENT',
        callbackUrl,
      },
      reference
    );

    await this.recordProviderResponse(tx.id, paymentResponse);

    this.logger.log(
      `HQ recharge initiated: ref=${reference} phone=${fullPhone} amount=${dto.amount} provider=${provider} success=${paymentResponse.success}`
    );

    return {
      transactionId: tx.id,
      providerTransactionId: paymentResponse.transactionId,
      provider: paymentResponse.provider ?? provider,
      message: paymentResponse.message,
    };
  }

  async getRechargeStatus(transactionId: string) {
    const tx = await this.mobilePaymentsDatabaseService.getTransactionById(transactionId);
    if (!tx) {
      throw new BadRequestException('Transaction not found');
    }
    return tx;
  }

  async listRecentRecharges(limit = 20, offset = 0) {
    const hqUser = await this.hasuraSystemService.getRendasuaHQUser();
    if (!hqUser) {
      throw new BadRequestException('HQ user not found');
    }
    const hqAccount = await this.hasuraSystemService.getAccount(hqUser.id, XAF);
    return this.mobilePaymentsDatabaseService.getTransactionsByAccountAndEntity(
      hqAccount.id,
      'account',
      limit,
      offset
    );
  }

  private validateDto(dto: InitiateAccountRechargeDto): void {
    if (!ALLOWED_COUNTRY_CODES.has(dto.countryCode)) {
      throw new BadRequestException(
        `Country code +${dto.countryCode} is not supported for mobile money recharge. Supported: +237 (Cameroon), +241 (Gabon).`
      );
    }
    if (dto.amount < MIN_AMOUNT) {
      throw new BadRequestException(`Minimum recharge amount is ${MIN_AMOUNT} XAF`);
    }
  }

  private buildE164Phone(countryCode: string, phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, '');
    return `+${countryCode}${digits}`;
  }

  private async resolveHqAccount() {
    const hqUser = await this.hasuraSystemService.getRendasuaHQUser();
    if (!hqUser) {
      throw new BadRequestException('Rendasua HQ user not found');
    }
    return this.hasuraSystemService.getAccount(hqUser.id, XAF);
  }

  private generateReference(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4);
    return `RCHG${timestamp}${random}`;
  }

  private async recordProviderResponse(
    txId: string,
    paymentResponse: { success: boolean; transactionId?: string; message?: string; errorCode?: string }
  ): Promise<void> {
    if (paymentResponse.success && paymentResponse.transactionId) {
      await this.mobilePaymentsDatabaseService.updateTransaction(txId, {
        transaction_id: paymentResponse.transactionId,
      });
    } else {
      await this.mobilePaymentsDatabaseService.updateTransaction(txId, {
        status: 'failed',
        error_message: paymentResponse.message,
        error_code: paymentResponse.errorCode,
      });
    }
  }
}
