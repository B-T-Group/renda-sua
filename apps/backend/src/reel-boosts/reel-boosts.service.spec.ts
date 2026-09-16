import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { REEL_CREDIT_PACKS, getReelCreditPack } from './reel-boosts.packs';
import { ReelBoostsService } from './reel-boosts.service';

describe('reel-boosts packs', () => {
  it('defines CAD and XAF prices for each pack', () => {
    for (const pack of REEL_CREDIT_PACKS) {
      expect(pack.prices.CAD).toBeGreaterThan(0);
      expect(pack.prices.XAF).toBeGreaterThan(0);
    }
  });

  it('resolves pack by id', () => {
    expect(getReelCreditPack('reel_pack_5')?.credits).toBe(5);
  });
});

describe('ReelBoostsService.boostReel', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  let service: ReelBoostsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReelBoostsService(hasura as never);
  });

  function mockMerchantAndReel(reel: {
    business_id: string;
    moderation_status: string;
    processing_status: string;
  }) {
    hasura.executeQuery
      .mockResolvedValueOnce({ businesses: [{ id: 'biz-1' }] })
      .mockResolvedValueOnce({ reels_by_pk: reel });
  }

  it('rejects boosting another merchant reel', async () => {
    mockMerchantAndReel({
      business_id: 'other-biz',
      moderation_status: 'approved',
      processing_status: 'ready',
    });

    await expect(service.boostReel('user-1', 'reel-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects boosting a reel that is not approved and ready', async () => {
    mockMerchantAndReel({
      business_id: 'biz-1',
      moderation_status: 'pending',
      processing_status: 'ready',
    });

    await expect(service.boostReel('user-1', 'reel-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('rejects boost when credits are insufficient', async () => {
    mockMerchantAndReel({
      business_id: 'biz-1',
      moderation_status: 'approved',
      processing_status: 'ready',
    });
    hasura.executeQuery.mockResolvedValueOnce({
      businesses_by_pk: { reel_credits: 0 },
    });

    await expect(service.boostReel('user-1', 'reel-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('debits one credit and writes a boost window', async () => {
    mockMerchantAndReel({
      business_id: 'biz-1',
      moderation_status: 'approved',
      processing_status: 'ready',
    });
    hasura.executeQuery.mockResolvedValueOnce({
      businesses_by_pk: { reel_credits: 3 },
    });
    hasura.executeMutation.mockResolvedValue({});

    await service.boostReel('user-1', 'reel-1');

    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('insert_reel_boosts_one'),
      expect.objectContaining({
        businessId: 'biz-1',
        reelId: 'reel-1',
        credits: 1,
      })
    );
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('_inc:{reel_credits:-$credits}'),
      { id: 'biz-1', credits: 1 }
    );
  });
});
