import { PickupProgressService } from './pickup-progress.service';
import { DEFAULT_PICKUP_MONITOR_CONFIG } from './order-pickup.types';

describe('PickupProgressService', () => {
  const makeService = (overrides?: {
    location?: { latitude: number; longitude: number; updated_at: string } | null;
  }) => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        agent_locations: overrides?.location ? [overrides.location] : [],
      }),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const google = {
      getDistanceMatrix: jest.fn().mockResolvedValue({
        rows: [{ elements: [{ duration: { value: 600 } }] }],
      }),
    };
    const events = { recordEvent: jest.fn().mockResolvedValue(undefined) };
    return new PickupProgressService(
      hasura as any,
      google as any,
      events as any
    );
  };

  it('treats missing GPS as unavailable without deferring', async () => {
    const service = makeService({ location: null });
    const result = await service.evaluate(
      {
        id: 'o1',
        order_number: '1',
        current_status: 'assigned_to_agent',
        assigned_agent_id: 'a1',
        assigned_at: null,
        pickup_by: null,
        pickup_due_at: null,
        pickup_state: 'monitoring',
        pickup_extension_minutes: 0,
        pickup_paused_at: null,
        pickup_pause_reason: null,
        pickup_pause_remaining_ms: null,
        reassignment_count: 0,
        last_agent_distance_m: null,
        last_agent_progress_at: null,
        agent_arrived_pickup_at: null,
        business_id: 'b1',
        business_location: {
          address: { latitude: 0.4, longitude: 9.4 },
        },
      },
      DEFAULT_PICKUP_MONITOR_CONFIG
    );
    expect(result.gpsUnavailable).toBe(true);
    expect(result.shouldDeferEscalation).toBe(false);
  });

  it('defers escalation when agent is inside geofence', async () => {
    const service = makeService({
      location: {
        latitude: 0.4,
        longitude: 9.4,
        updated_at: new Date().toISOString(),
      },
    });
    const result = await service.evaluate(
      {
        id: 'o1',
        order_number: '1',
        current_status: 'assigned_to_agent',
        assigned_agent_id: 'a1',
        assigned_at: null,
        pickup_by: null,
        pickup_due_at: null,
        pickup_state: 'monitoring',
        pickup_extension_minutes: 0,
        pickup_paused_at: null,
        pickup_pause_reason: null,
        pickup_pause_remaining_ms: null,
        reassignment_count: 0,
        last_agent_distance_m: 500,
        last_agent_progress_at: null,
        agent_arrived_pickup_at: null,
        business_id: 'b1',
        business_location: {
          address: { latitude: 0.4, longitude: 9.4 },
        },
      },
      DEFAULT_PICKUP_MONITOR_CONFIG
    );
    expect(result.isArrived).toBe(true);
    expect(result.shouldDeferEscalation).toBe(true);
  });
});
