import { BadRequestException } from '@nestjs/common';
import { SiteEventsService } from './site-events.service';

describe('SiteEventsService metadata guard', () => {
  let service: SiteEventsService;
  let hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock };

  beforeEach(() => {
    hasura = {
      executeQuery: jest.fn().mockResolvedValue({ site_events: [] }),
      executeMutation: jest.fn().mockResolvedValue({
        insert_site_events_one: { id: 'evt-1' },
      }),
    };
    service = new SiteEventsService(hasura as any);
  });

  it('accepts auth_gate_shown and drops PII fields', async () => {
    await service.trackEvent(
      {
        eventType: 'auth_gate_shown',
        metadata: {
          entry: 'foods_order',
          platform: 'web',
          email: 'user@example.com',
          phone: '+237670000000',
        },
      },
      { viewerType: 'anon', viewerId: 'a1', jwtVerified: false }
    );

    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertSiteEvent'),
      {
        object: expect.objectContaining({
          event_type: 'auth_gate_shown',
          metadata: expect.objectContaining({
            entry: 'foods_order',
            platform: 'web',
          }),
        }),
      }
    );
    const metadata =
      hasura.executeMutation.mock.calls[0][1].object.metadata;
    expect(metadata.email).toBeUndefined();
    expect(metadata.phone).toBeUndefined();
  });

  it('rejects oversized metadata after sanitization', async () => {
    const huge = 'x'.repeat(5000);
    await expect(
      service.trackEvent(
        {
          eventType: 'ftue.onboarding.started',
          metadata: { note: huge },
        },
        { viewerType: 'anon', viewerId: 'a1', jwtVerified: false }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
