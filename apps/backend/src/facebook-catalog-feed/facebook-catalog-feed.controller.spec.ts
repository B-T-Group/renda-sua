import { UnauthorizedException } from '@nestjs/common';
import { FacebookCatalogFeedController } from './facebook-catalog-feed.controller';

describe('FacebookCatalogFeedController', () => {
  let controller: FacebookCatalogFeedController;
  let feedService: { buildCsv: jest.Mock };
  let configService: { get: jest.Mock };
  let res: { setHeader: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    feedService = {
      buildCsv: jest.fn().mockResolvedValue({ csv: 'id,title\n1,Item\n' }),
    };
    configService = {
      get: jest.fn().mockReturnValue({ token: 'feed-secret' }),
    };
    res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    controller = new FacebookCatalogFeedController(
      feedService as any,
      configService as any
    );
  });

  it('rejects missing token without building CSV', async () => {
    await expect(
      controller.getFacebookCatalogCsv(undefined, res as any)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(feedService.buildCsv).not.toHaveBeenCalled();
  });

  it('rejects wrong token without building CSV', async () => {
    await expect(
      controller.getFacebookCatalogCsv('wrong', res as any)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(feedService.buildCsv).not.toHaveBeenCalled();
  });

  it('rejects when feed token is not configured', async () => {
    configService.get.mockReturnValue({ token: '' });
    await expect(
      controller.getFacebookCatalogCsv('feed-secret', res as any)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(feedService.buildCsv).not.toHaveBeenCalled();
  });

  it('rejects when facebookCatalogFeed config is missing', async () => {
    configService.get.mockReturnValue(undefined);
    await expect(
      controller.getFacebookCatalogCsv('feed-secret', res as any)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(feedService.buildCsv).not.toHaveBeenCalled();
  });

  it('returns CSV when token matches', async () => {
    await controller.getFacebookCatalogCsv('feed-secret', res as any);
    expect(feedService.buildCsv).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8'
    );
    expect(res.send).toHaveBeenCalledWith('id,title\n1,Item\n');
  });
});
