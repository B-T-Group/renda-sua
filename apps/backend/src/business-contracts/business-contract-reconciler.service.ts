import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import type { BoldSignConfig, Configuration } from '../config/configuration';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { BoldsignClientService } from './boldsign-client.service';
import { BusinessContractsDatabaseService } from './business-contracts-database.service';
import { BusinessContractsService } from './business-contracts.service';

@Injectable()
export class BusinessContractReconcilerService {
  private readonly logger = new Logger(BusinessContractReconcilerService.name);

  constructor(
    private readonly db: BusinessContractsDatabaseService,
    private readonly contractsService: BusinessContractsService,
    private readonly boldsign: BoldsignClientService,
    private readonly configService: ConfigService<Configuration>,
    @Inject(forwardRef(() => MerchantLifecycleService))
    private readonly merchantLifecycleService: MerchantLifecycleService
  ) {}

  private get config(): BoldSignConfig {
    return this.configService.get<BoldSignConfig>('boldsign') as BoldSignConfig;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async reconcile(): Promise<void> {
    if (!this.config.enabled) return;
    await this.retryFailedCreations();
    await this.syncStaleDocuments();
    await this.sendReminders();
  }

  private async retryFailedCreations(): Promise<void> {
    const pending = await this.db.listPendingRetries();
    for (const row of pending) {
      if (!row.boldsign_document_id.startsWith('pending:')) continue;
      try {
        await this.contractsService.ensureContractForBusiness(row.business_id);
      } catch (error: any) {
        this.logger.warn(
          `Contract retry failed for ${row.business_id}: ${error?.message}`
        );
      }
    }
  }

  private async syncStaleDocuments(): Promise<void> {
    const cutoff = new Date(Date.now() - 3600000).toISOString();
    const rows = await this.db.listStaleSentContracts(cutoff);
    for (const row of rows) {
      if (row.boldsign_document_id.startsWith('legacy:')) continue;
      try {
        const props = await this.boldsign.getDocumentProperties(
          row.boldsign_document_id
        );
        const status = String((props as { status?: string }).status ?? '');
        if (status.toLowerCase() === 'completed') {
          await this.db.updateContract(row.id, {
            status: 'signed',
            signed_at: new Date().toISOString(),
            boldsign_raw_metadata: props,
          });
          await this.contractsService.syncSignedArtifactsFromBoldsign(
            row.id,
            row.boldsign_document_id
          );
          await this.merchantLifecycleService.recompute(
            row.business_id,
            'contract_reconciled'
          );
        }
      } catch (error: any) {
        this.logger.debug(`Sync skip ${row.id}: ${error?.message}`);
      }
    }
  }

  private async sendReminders(): Promise<void> {
    const days = this.config.reminderIntervalDays || 3;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const stale = await this.db.listStaleSentContracts(cutoff);
    for (const row of stale) {
      if (row.boldsign_document_id.startsWith('legacy:')) continue;
      try {
        await this.boldsign.remindDocument(row.boldsign_document_id);
      } catch (error: any) {
        this.logger.warn(`Reminder failed ${row.id}: ${error?.message}`);
      }
    }
  }
}
