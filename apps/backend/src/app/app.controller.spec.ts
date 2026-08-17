import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: HasuraSystemService,
          useValue: { executeQuery: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: { info: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();
  });

  describe('getHealth', () => {
    it('should return health status', async () => {
      const appController = app.get<AppController>(AppController);
      const res = { status: jest.fn() } as any;
      await expect(appController.getHealth(res)).resolves.toEqual(
        expect.objectContaining({ status: 'healthy' })
      );
    });
  });
});
