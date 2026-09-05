import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SignupService } from './signup.service';

@Injectable()
export class SignupAttemptCleanupService {
  private readonly logger = new Logger(SignupAttemptCleanupService.name);

  constructor(private readonly signupService: SignupService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredAttempts(): Promise<void> {
    try {
      const removed = await this.signupService.purgeExpiredAttempts();
      if (removed > 0) {
        this.logger.log(`Purged ${removed} expired signup attempts`);
      }
    } catch (error: any) {
      this.logger.warn(
        `Signup attempt cleanup failed: ${error?.message || 'unknown'}`
      );
    }
  }
}
