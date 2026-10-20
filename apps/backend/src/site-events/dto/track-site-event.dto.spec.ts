import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { validate } from 'class-validator';
import { TrackSiteEventDto } from './track-site-event.dto';
import { DEDICATED_UI_SITE_EVENT_TYPES, SERVER_SITE_EVENT_TYPES, SITE_EVENT_TYPES_V1 } from '../site-event-types';

describe('TrackSiteEventDto', () => {
  it('accepts valid public event types', async () => {
    const dto = new TrackSiteEventDto();
    dto.eventType = 'assistant.launcher.impression' as any;
    dto.metadata = { screen: 'ClientBrowseHomeScreen' };

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts reorder event types', async () => {
    const dto = new TrackSiteEventDto();
    dto.eventType = 'orders.reorder.impression' as any;
    dto.metadata = { orderId: '550e8400-e29b-41d4-a716-446655440000' };

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it.each([
    'search.results_shown',
    'search.sort_changed',
    'search.empty_shown',
    'search.empty_rung_clicked',
    'search.filter_removed_from_empty',
    'card.rating_shown',
  ])('accepts discovery event %s (#342)', async (eventType) => {
    const dto = new TrackSiteEventDto();
    dto.eventType = eventType as any;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects assistant.message.classified (server-only)', async () => {
    const dto = new TrackSiteEventDto();
    dto.eventType = 'assistant.message.classified' as any;
    dto.metadata = {
      thread_id: '550e8400-e29b-41d4-a716-446655440000',
      intent: 'buy',
    };

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('eventType');
    expect(errors[0].constraints?.isIn).toBeDefined();
  });

  it('rejects assistant.support.deflected (server-only)', async () => {
    const dto = new TrackSiteEventDto();
    dto.eventType = 'assistant.support.deflected' as any;
    dto.metadata = {
      thread_id: '550e8400-e29b-41d4-a716-446655440000',
    };

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('eventType');
    expect(errors[0].constraints?.isIn).toBeDefined();
  });

  it('counts assistant public event types correctly', () => {
    const assistantEvents = [...SITE_EVENT_TYPES_V1].filter((type) =>
      type.startsWith('assistant.')
    );
    // 15 assistant event types in SITE_EVENT_TYPES_V1 (public events only, 2 moved to server-only)
    expect(assistantEvents).toHaveLength(15);
  });

  it('counts total new event types correctly', () => {
    const reorderEvents = [...SITE_EVENT_TYPES_V1].filter((type) =>
      type.startsWith('orders.reorder.')
    );
    const assistantEvents = [...SITE_EVENT_TYPES_V1].filter((type) =>
      type.startsWith('assistant.')
    );
    // 3 reorder + 15 assistant = 18 new public types
    expect(reorderEvents.length + assistantEvents.length).toBe(18);
  });

  describe('#594 dedicated agents UI events (#644, #645, #646)', () => {
    const FROM_646 = [
      'dedicated_ui.section_viewed',
      'dedicated_ui.admin_assign_started',
      'dedicated_ui.admin_assign_step',
      'dedicated_ui.admin_assign_succeeded',
      'dedicated_ui.admin_assign_failed',
      'dedicated_ui.agent_paused',
      'dedicated_ui.agent_resumed',
      'dedicated_ui.agent_removed',
      'dedicated_ui.action_conflict',
    ];

    it.each(FROM_646)('accepts %s (admin #646)', async (eventType) => {
      const dto = new TrackSiteEventDto();
      dto.eventType = eventType as any;
      dto.metadata = { locationId: '550e8400-e29b-41d4-a716-446655440000' };
      expect(await validate(dto)).toHaveLength(0);
    });

    it.each([...DEDICATED_UI_SITE_EVENT_TYPES])('accepts %s', async (eventType) => {
      const dto = new TrackSiteEventDto();
      dto.eventType = eventType as any;
      expect(await validate(dto)).toHaveLength(0);
    });

    it('lists 31 unique client events, all public, none server-only', () => {
      expect(new Set(DEDICATED_UI_SITE_EVENT_TYPES).size).toBe(31);
      expect(DEDICATED_UI_SITE_EVENT_TYPES).toEqual(expect.arrayContaining(FROM_646));
      for (const t of DEDICATED_UI_SITE_EVENT_TYPES) {
        expect(SITE_EVENT_TYPES_V1 as readonly string[]).toContain(t);
        expect(SERVER_SITE_EVENT_TYPES as readonly string[]).not.toContain(t);
      }
    });

    it('through the controller ValidationPipe: a #646 event passes, an unknown one is a 400', async () => {
      const pipe = new ValidationPipe({ transform: true, whitelist: true });
      const meta = { type: 'body' as const, metatype: TrackSiteEventDto };
      await expect(pipe.transform({ eventType: 'dedicated_ui.admin_assign_step' }, meta)).resolves.toMatchObject({
        eventType: 'dedicated_ui.admin_assign_step',
      });
      await expect(pipe.transform({ eventType: 'dedicated_ui.nope' }, meta)).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(['dedicated_ui.unknown_event', 'dedicated_ui.section_opened', 'dedicated_ui.', 'dedicated.posting_created'])(
      'still rejects %s (isIn -> 400)',
      async (eventType) => {
        const dto = new TrackSiteEventDto();
        dto.eventType = eventType as any;
        const errors = await validate(dto);
        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('eventType');
        expect(errors[0].constraints?.isIn).toBeDefined();
      }
    );
  });
});
