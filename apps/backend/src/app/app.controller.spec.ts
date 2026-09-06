import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { LockoutService } from '../auth/lockout.service';
import { SessionStoreService } from '../auth/session-store.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;
  const lockout = { isStoreReady: jest.fn(() => true) };
  const sessionStore = { isStoreReady: jest.fn(() => true) };

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: HasuraSystemService,
          useValue: { executeQuery: jest.fn().mockResolvedValue({}) },
        },
        { provide: LockoutService, useValue: lockout },
        { provide: SessionStoreService, useValue: sessionStore },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();
  });

  describe('getHealth', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      lockout.isStoreReady.mockReturnValue(true);
      sessionStore.isStoreReady.mockReturnValue(true);
    });

    it('should return health status', async () => {
      const appController = app.get<AppController>(AppController);
      const res = { status: jest.fn() } as any;
      await expect(appController.getHealth(res)).resolves.toEqual(
        expect.objectContaining({
          status: 'healthy',
          redis: { status: 'skipped' },
        })
      );
    });

    it('returns 503 in production when Redis is not ready', async () => {
      process.env.NODE_ENV = 'production';
      lockout.isStoreReady.mockReturnValue(false);
      const appController = app.get<AppController>(AppController);
      const res = { status: jest.fn() } as any;
      await expect(appController.getHealth(res)).resolves.toEqual(
        expect.objectContaining({
          status: 'unhealthy',
          redis: { status: 'down' },
        })
      );
      expect(res.status).toHaveBeenCalledWith(503);
    });
  });
});
