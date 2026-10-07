import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentHoldService } from './agent-hold.service';

/**
 * Loss guard scheduler for agent hold ceiling (issue #450).
 * Checks weekly agent-fault loss cap and auto-disables ceiling when exceeded.
 * Runs every hour (can be adjusted based on operational needs).
 */
@Injectable()
export class AgentHoldLossGuardService {
  private readonly logger = new Logger(AgentHoldLossGuardService.name);
  private running = false;

  constructor(private readonly agentHoldService: AgentHoldService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkLossGuard(): Promise<void> {
    if (this.running) {
      this.logger.debug('Loss guard check already running, skipping');
      return;
    }

    this.running = true;
    try {
      const result = await this.agentHoldService.checkAndEnforceLossGuard();

      if (result.exceeded) {
        this.logger.warn(
          `Weekly agent-fault loss exceeded cap: ${result.weeklyLoss} XAF > ${result.cap} XAF. ` +
            `Auto-disabled: ${result.autoDisabled}`
        );
      } else {
        this.logger.debug(
          `Loss guard check passed: ${result.weeklyLoss} XAF <= ${result.cap} XAF`
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Loss guard check failed: ${error?.message ?? error}`,
        error?.stack
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Manual trigger for testing or ops intervention.
   * Returns the loss guard check result.
   */
  async manualCheck(): Promise<{
    exceeded: boolean;
    weeklyLoss: number;
    cap: number | null;
    autoDisabled: boolean;
  }> {
    this.logger.log('Manual loss guard check triggered');
    return this.agentHoldService.checkAndEnforceLossGuard();
  }
}
