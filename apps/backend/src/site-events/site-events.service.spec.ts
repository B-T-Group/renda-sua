import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { SiteEventsService } from './site-events.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

describe('SiteEventsService', () => {
  let service: SiteEventsService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;

  beforeEach(async () => {
    const mockHasuraSystemService = {
      executeMutation: jest.fn().mockResolvedValue({ insert_site_events_one: { id: 'evt-1' } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiteEventsService,
        { provide: HasuraSystemService, useValue: mockHasuraSystemService },
      ],
    }).compile();

    service = module.get<SiteEventsService>(SiteEventsService);
    hasuraSystemService = module.get(HasuraSystemService);
  });

  it('preserves server event IDs with digits through trackEvent', async () => {
    const orderId = randomUUID();
    const agentId = randomUUID();
    const transactionId = randomUUID();
    const businessId = randomUUID();
    const businessLocationId = randomUUID();
    const clientId = randomUUID();

    await service.trackEvent(
      {
        eventType: 'agent.claim_funds_check',
        metadata: {
          orderId,
          orderNumber: '12041661',
          agentId,
          transactionId,
          businessId,
          businessLocationId,
          clientId,
          holdAmount: 8000,
          currency: 'XAF',
        },
      },
      {
        viewerType: 'server',
        viewerId: 'system',
        jwtVerified: false,
      }
    );

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledTimes(1);
    const mutation = hasuraSystemService.executeMutation.mock.calls[0][0];
    const variables = hasuraSystemService.executeMutation.mock.calls[0][1];

    expect(mutation).toContain('insert_site_events_one');
    expect(variables.object.metadata).toEqual(
      expect.objectContaining({
        orderId,
        orderNumber: '12041661',
        agentId,
        transactionId,
        businessId,
        businessLocationId,
        clientId,
        holdAmount: 8000,
        currency: 'XAF',
      })
    );
  });

  it('strips phone and email under non-allowlisted keys even for server events', async () => {
    await service.trackEvent(
      {
        eventType: 'agent.claim_funds_check',
        metadata: {
          orderId: randomUUID(),
          userPhone: '+237612345678',
          userEmail: 'test@example.com',
          someData: 'safe-value',
        },
      },
      {
        viewerType: 'server',
        viewerId: 'system',
        jwtVerified: false,
      }
    );

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledTimes(1);
    const variables = hasuraSystemService.executeMutation.mock.calls[0][1];

    // Phone and email should be stripped (not in allowlist)
    expect(variables.object.metadata).not.toHaveProperty('userPhone');
    expect(variables.object.metadata).not.toHaveProperty('userEmail');
    // Safe data should be preserved
    expect(variables.object.metadata).toHaveProperty('someData', 'safe-value');
    expect(variables.object.metadata).toHaveProperty('orderId');
  });
});
