import { validate } from 'class-validator';
import { TrackSiteEventDto } from './track-site-event.dto';
import { SITE_EVENT_TYPES_V1 } from '../site-event-types';

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
});
