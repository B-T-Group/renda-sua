import { ReelMerchantNotifyService } from './reel-merchant-notify.service';

describe('ReelMerchantNotifyService', () => {
  const hasura = { executeQuery: jest.fn() };
  const notifications = { sendReelMerchantPush: jest.fn() };
  const deepLinks = {
    myReels: jest.fn().mockReturnValue({
      path: '/business/reels/mine',
      app: 'rendasua://business/my-reels',
    }),
  };
  const config = { get: jest.fn() };

  let service: ReelMerchantNotifyService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) =>
      key === 'push' ? { enabled: true } : undefined
    );
    deepLinks.myReels.mockReturnValue({
      path: '/business/reels/mine',
      app: 'rendasua://business/my-reels',
    });
    service = new ReelMerchantNotifyService(
      hasura as never,
      notifications as never,
      deepLinks as never,
      config as never
    );
  });

  function mockOwner(userId?: string, preferredLanguage?: string | null) {
    hasura.executeQuery.mockResolvedValueOnce({
      reels_by_pk: userId
        ? { business: { user_id: userId, user: { preferred_language: preferredLanguage } } }
        : { business: null },
    });
  }

  it('does nothing when push is disabled', async () => {
    config.get.mockReturnValue({ enabled: false });

    await service.notifyLive('reel-1');

    expect(hasura.executeQuery).not.toHaveBeenCalled();
    expect(notifications.sendReelMerchantPush).not.toHaveBeenCalled();
  });

  it('skips when the reel has no business owner', async () => {
    mockOwner();

    await service.notifyFailed('reel-1');

    expect(notifications.sendReelMerchantPush).not.toHaveBeenCalled();
  });

  it('sends French live copy after approval', async () => {
    mockOwner('user-1', 'fr-CM');

    await service.notifyModeration('reel-1', 'approved');

    expect(notifications.sendReelMerchantPush).toHaveBeenCalledWith({
      userId: 'user-1',
      title: 'Votre reel est en ligne',
      body: 'Votre vidéo a été approuvée et est visible dans le fil Reels.',
      reelId: 'reel-1',
      event: 'reel.moderation.approved',
      url: '/business/reels/mine',
      appUrl: 'rendasua://business/my-reels',
    });
  });

  it('sends auto-sponsored live copy with My Reels deep link', async () => {
    mockOwner('user-1', 'en');

    await service.notifyAutoSponsoredLive('reel-sponsored');

    expect(notifications.sendReelMerchantPush).toHaveBeenCalledWith({
      userId: 'user-1',
      title: 'We created an ad for you',
      body: expect.stringContaining('sponsored reel'),
      reelId: 'reel-sponsored',
      event: 'reel.auto_sponsored.live',
      url: '/business/reels/mine',
      appUrl: 'rendasua://business/my-reels',
    });
  });

  it('routes rejected moderation to the rejected event', async () => {
    mockOwner('user-1', 'en');

    await service.notifyModeration('reel-1', 'rejected');

    expect(notifications.sendReelMerchantPush).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'reel.moderation.rejected',
        title: 'Reel not approved',
      })
    );
  });

  it('sends pending-review and failed events with English defaults', async () => {
    mockOwner('user-1', null);
    await service.notifyPendingReview('reel-1');
    mockOwner('user-1', '');
    await service.notifyFailed('reel-2');

    expect(notifications.sendReelMerchantPush).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'reel.processing.ready',
        title: 'Reel ready for review',
      })
    );
    expect(notifications.sendReelMerchantPush).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        reelId: 'reel-2',
        event: 'reel.processing.failed',
        title: 'Reel generation failed',
      })
    );
  });

  it('swallows owner lookup failures', async () => {
    hasura.executeQuery.mockRejectedValueOnce(new Error('hasura down'));

    await expect(service.notifyLive('reel-1')).resolves.toBeUndefined();
    expect(notifications.sendReelMerchantPush).not.toHaveBeenCalled();
  });
});
