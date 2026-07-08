import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StripeConfig } from '../config/configuration';
import { StripeService } from '../stripe-payments/stripe.service';
import { STRIPE_TAX_CODE_GENERAL_TANGIBLE } from './stripe-tax.constants';
import { StripeTaxCodesDatabaseService } from './stripe-tax-codes-database.service';

@Injectable()
export class StripeTaxCodesService implements OnModuleInit {
  private readonly logger = new Logger(StripeTaxCodesService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly database: StripeTaxCodesDatabaseService,
    private readonly configService: ConfigService
  ) {}

  private get stripeConfig(): StripeConfig {
    return this.configService.get<StripeConfig>('stripe') as StripeConfig;
  }

  async onModuleInit(): Promise<void> {
    if (!this.stripeConfig.secretKey) return;
    try {
      await this.database.ensureDefaultCodeExists();
      const count = await this.syncFromStripe();
      this.logger.log(`Stripe tax codes sync on startup: ${count.upserted} upserted`);
    } catch (error: any) {
      this.logger.warn(
        `Stripe tax codes startup sync skipped: ${error?.message || error}`
      );
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async scheduledSync(): Promise<void> {
    if (!this.stripeConfig.secretKey) return;
    try {
      const result = await this.syncFromStripe();
      this.logger.log(
        `Weekly Stripe tax codes sync: ${result.upserted} upserted, ${result.deactivated} deactivated`
      );
    } catch (error: any) {
      this.logger.error(`Weekly tax code sync failed: ${error?.message || error}`);
    }
  }

  async syncFromStripe(): Promise<{ upserted: number; deactivated: number }> {
    const codes = await this.stripeService.listAllTaxCodes();
    const objects = codes.map((code) => ({
      id: code.id,
      name: code.name,
      description: code.description ?? null,
      requirements: ((code as { requirements?: Record<string, unknown> }).requirements) ?? null,
      group_name: this.deriveGroupName(code.name),
      is_active: true,
    }));
    const upserted = await this.database.upsertMany(objects);
    const ids = codes.map((c) => c.id);
    const deactivated = await this.database.deactivateExcept(ids);
    return { upserted, deactivated };
  }

  deriveGroupName(name: string): string | null {
    const idx = name.indexOf(' - ');
    if (idx <= 0) return null;
    return name.slice(0, idx).trim();
  }

  async validateTaxCodeId(
    taxCodeId: string | null | undefined
  ): Promise<string> {
    const id = taxCodeId?.trim() || STRIPE_TAX_CODE_GENERAL_TANGIBLE;
    const active = await this.database.isActiveCode(id);
    if (!active) {
      throw new Error(`Invalid or inactive Stripe tax code: ${id}`);
    }
    return id;
  }
}
