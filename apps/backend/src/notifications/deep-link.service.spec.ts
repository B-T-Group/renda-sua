import { ConfigService } from '@nestjs/config';
import { DeepLinkService } from './deep-link.service';

describe('DeepLinkService', () => {
  let service: DeepLinkService;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue('https://rendasua.com'),
    } as unknown as ConfigService;
    service = new DeepLinkService(configService);
  });

  it('builds order deep links', () => {
    const links = service.order('abc-123');
    expect(links.app).toBe('rendasua://orders/abc-123');
    expect(links.universal).toBe('https://rendasua.com/app/orders/abc-123');
    expect(links.path).toBe('/orders/abc-123');
  });

  it('builds product interest inbox links', () => {
    const links = service.productInterest();
    expect(links.app).toBe('rendasua://business/product-interest');
    expect(links.universal).toBe(
      'https://rendasua.com/app/business/product-interest'
    );
    expect(links.path).toBe('/business/product-interest');
  });

  it('builds wallet links', () => {
    const links = service.wallet();
    expect(links.app).toBe('rendasua://wallet');
    expect(links.universal).toBe('https://rendasua.com/app/wallet');
    expect(links.path).toBe('/accounts');
  });

  it('builds verification links', () => {
    const links = service.verification();
    expect(links.universal).toBe('https://rendasua.com/app/verification');
    expect(links.path).toBe('/documents');
  });

  it('strips trailing slash from public web origin', () => {
    const configService = {
      get: jest.fn().mockReturnValue('https://dev.rendasua.com/'),
    } as unknown as ConfigService;
    service = new DeepLinkService(configService);
    expect(service.order('x').universal).toBe(
      'https://dev.rendasua.com/app/orders/x'
    );
  });
});
