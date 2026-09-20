import { Injectable, Logger } from '@nestjs/common';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { CreditCampaignRunnerService } from './credit-campaign-runner.service';
import type { SignupCampaignEvent } from './credit-campaign.policy';

@Injectable()
export class CreditCampaignPublisher {
  private readonly logger = new Logger(CreditCampaignPublisher.name);

  constructor(private readonly runner: CreditCampaignRunnerService) {}

  async publishSignup(event: SignupCampaignEvent): Promise<void> {
    await this.runner.applySignup(event);
    await this.putEvent(event);
  }

  private async putEvent(event: SignupCampaignEvent): Promise<void> {
    const bus = process.env.CREDIT_CAMPAIGN_EVENT_BUS_NAME;
    if (!bus) return;
    try {
      const client = new EventBridgeClient({});
      await client.send(
        new PutEventsCommand({
          Entries: [
            {
              EventBusName: bus,
              Source: 'rendasua.signup',
              DetailType: 'signup.completed',
              Detail: JSON.stringify(event),
            },
          ],
        })
      );
    } catch (error: any) {
      this.logger.warn(`signup.completed publish failed: ${error?.message ?? error}`);
    }
  }
}
