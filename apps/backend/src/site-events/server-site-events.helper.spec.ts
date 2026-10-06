import { SiteEventsService } from './site-events.service';
import { emitServerSiteEvent } from './server-site-events.helper';

describe('emitServerSiteEvent', () => {
  let mockSiteEventsService: jest.Mocked<SiteEventsService>;

  beforeEach(() => {
    mockSiteEventsService = {
      trackEvent: jest.fn().mockResolvedValue(undefined),
    } as any;
  });

  it('should emit event with server viewer and no subject', async () => {
    emitServerSiteEvent(mockSiteEventsService, 'agent.claim_funds_check', {
      orderId: 'order-123',
      agentId: 'agent-456',
      holdAmount: 5000,
    });

    // Fire-and-forget: wait for next tick
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockSiteEventsService.trackEvent).toHaveBeenCalledWith(
      {
        eventType: 'agent.claim_funds_check',
        metadata: {
          orderId: 'order-123',
          agentId: 'agent-456',
          holdAmount: 5000,
        },
        subjectType: undefined,
        subjectId: undefined,
      },
      {
        viewerType: 'server',
        viewerId: 'system',
        jwtVerified: false,
      }
    );
  });

  it('should not throw when trackEvent fails', async () => {
    mockSiteEventsService.trackEvent.mockRejectedValue(
      new Error('Insert failed')
    );

    expect(() => {
      emitServerSiteEvent(mockSiteEventsService, 'agent.claim_funds_check', {
        test: 'data',
      });
    }).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
  });

  it('should allow repeated calls without subject-based dedupe', async () => {
    const metadata = { orderId: 'order-123', agentId: 'agent-456' };

    emitServerSiteEvent(
      mockSiteEventsService,
      'agent.claim_funds_check',
      metadata
    );
    emitServerSiteEvent(
      mockSiteEventsService,
      'agent.claim_funds_check',
      metadata
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(mockSiteEventsService.trackEvent).toHaveBeenCalledTimes(2);
    expect(mockSiteEventsService.trackEvent).toHaveBeenNthCalledWith(
      1,
      {
        eventType: 'agent.claim_funds_check',
        metadata,
        subjectType: undefined,
        subjectId: undefined,
      },
      {
        viewerType: 'server',
        viewerId: 'system',
        jwtVerified: false,
      }
    );
    expect(mockSiteEventsService.trackEvent).toHaveBeenNthCalledWith(
      2,
      {
        eventType: 'agent.claim_funds_check',
        metadata,
        subjectType: undefined,
        subjectId: undefined,
      },
      {
        viewerType: 'server',
        viewerId: 'system',
        jwtVerified: false,
      }
    );
  });
});
