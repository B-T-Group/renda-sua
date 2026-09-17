import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DeepLinkService } from './deep-link.service';
import { NotificationsService } from './notifications.service';
import {
  buildReelAutoSponsoredLivePush,
  buildReelGenerationFailedPush,
  buildReelModerationApprovedPush,
  buildReelModerationRejectedPush,
  buildReelPendingReviewPush,
} from './reel-push.messages';

type OwnerRow = {
  user_id: string;
  user?: { preferred_language?: string | null } | null;
};

@Injectable()
export class ReelMerchantNotifyService {
  private readonly logger = new Logger(ReelMerchantNotifyService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly notifications: NotificationsService,
    private readonly deepLinks: DeepLinkService,
    private readonly config: ConfigService<Configuration>
  ) {}

  async notifyLive(reelId: string): Promise<void> {
    await this.send(reelId, 'reel.moderation.approved', (lang) =>
      buildReelModerationApprovedPush({ preferredLanguage: lang })
    );
  }

  async notifyAutoSponsoredLive(reelId: string): Promise<void> {
    await this.send(reelId, 'reel.auto_sponsored.live', (lang) =>
      buildReelAutoSponsoredLivePush({ preferredLanguage: lang })
    );
  }

  async notifyPendingReview(reelId: string): Promise<void> {
    await this.send(reelId, 'reel.processing.ready', (lang) =>
      buildReelPendingReviewPush({ preferredLanguage: lang })
    );
  }

  async notifyFailed(reelId: string): Promise<void> {
    await this.send(reelId, 'reel.processing.failed', (lang) =>
      buildReelGenerationFailedPush({ preferredLanguage: lang })
    );
  }

  async notifyModeration(
    reelId: string,
    status: 'approved' | 'rejected'
  ): Promise<void> {
    if (status === 'approved') {
      await this.notifyLive(reelId);
      return;
    }
    await this.send(reelId, 'reel.moderation.rejected', (lang) =>
      buildReelModerationRejectedPush({ preferredLanguage: lang })
    );
  }

  private async send(
    reelId: string,
    event: string,
    build: (lang?: string | null) => { title: string; body: string }
  ): Promise<void> {
    if (!this.config.get('push')?.enabled) return;
    try {
      const owner = await this.loadOwner(reelId);
      if (!owner?.user_id) return;
      const { title, body } = build(owner.user?.preferred_language);
      const links = this.deepLinks.myReels();
      await this.notifications.sendReelMerchantPush({
        userId: owner.user_id,
        title,
        body,
        reelId,
        event,
        url: links.path,
        appUrl: links.app,
      });
    } catch (error: any) {
      this.logger.warn(
        `Reel merchant notify failed (${event}): ${error?.message ?? String(error)}`
      );
    }
  }

  private async loadOwner(reelId: string): Promise<OwnerRow | null> {
    const result = await this.hasura.executeQuery<{
      reels_by_pk: {
        business?: OwnerRow | null;
      } | null;
    }>(
      `query($id:uuid!){
        reels_by_pk(id:$id){
          business {
            user_id
            user { preferred_language }
          }
        }
      }`,
      { id: reelId }
    );
    return result.reels_by_pk?.business ?? null;
  }
}
