import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;
  const configGet = jest.fn(() => ({
    minVersion: '1.0.10',
    recommendedVersion: '1.0.12',
  }));

  beforeAll(async () => {
    const app: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: ConfigService, useValue: { get: configGet } },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(service.getHello()).toBe('Hello World!');
    });
  });

  describe('getMobileVersionPolicy', () => {
    it('maps configured versions', () => {
      expect(service.getMobileVersionPolicy()).toEqual({
        minVersion: '1.0.10',
        recommendedVersion: '1.0.12',
      });
    });
  });
});
