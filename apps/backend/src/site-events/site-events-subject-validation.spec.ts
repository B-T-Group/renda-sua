import { BadRequestException } from '@nestjs/common';
import { SiteEventsService } from './site-events.service';

describe('SiteEventsService subject validation', () => {
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

  it('allows FTUE events without inventory subjects', async () => {
    await service.trackEvent(
      { eventType: 'ftue.onboarding.started' },
      { viewerType: 'anon', viewerId: 'a1', jwtVerified: false }
    );

    expect(hasura.executeQuery).not.toHaveBeenCalled();
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertSiteEvent'),
      {
        object: expect.objectContaining({
          event_type: 'ftue.onboarding.started',
          subject_type: null,
          subject_id: null,
          viewer_type: 'anon',
          viewer_id: 'a1',
        }),
      }
    );
  });

  it('allows product-create funnel events without subjects', async () => {
    await service.trackEvent(
      { eventType: 'product_create.published' },
      { viewerType: 'user', viewerId: 'u1', jwtVerified: false }
    );

    expect(hasura.executeMutation).toHaveBeenCalled();
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('requires inventory_item subject for inventory CTA events', async () => {
    await expect(
      service.trackEvent(
        { eventType: 'inventory.cta.buy_now_click' },
        { viewerType: 'anon', viewerId: 'a1', jwtVerified: false }
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects non-inventory subjects even on funnel events', async () => {
    await expect(
      service.trackEvent(
        {
          eventType: 'ftue.browse.session_started',
          subjectType: 'order',
          subjectId: '11111111-1111-4111-8111-111111111111',
        },
        { viewerType: 'anon', viewerId: 'a1', jwtVerified: false }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tracks inventory card clicks with subject and checks dedupe', async () => {
    const subjectId = '22222222-2222-4222-8222-222222222222';
    await service.trackEvent(
      {
        eventType: 'inventory.card.view_details_click',
        subjectType: 'inventory_item',
        subjectId,
      },
      { viewerType: 'user', viewerId: 'u1', jwtVerified: false }
    );

    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('RecentDuplicateLookup'),
      expect.objectContaining({
        eventType: 'inventory.card.view_details_click',
        subjectType: 'inventory_item',
        subjectId,
      })
    );
    expect(hasura.executeMutation).toHaveBeenCalled();
  });

  it('skips insert when a recent duplicate exists', async () => {
    hasura.executeQuery.mockResolvedValue({
      site_events: [{ id: 'dup-1' }],
    });

    await service.trackEvent(
      {
        eventType: 'inventory.cta.order_now_click',
        subjectType: 'inventory_item',
        subjectId: '33333333-3333-4333-8333-333333333333',
      },
      { viewerType: 'anon', viewerId: 'a1', jwtVerified: false }
    );

    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });
});
