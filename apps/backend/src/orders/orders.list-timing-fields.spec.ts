import { GET_ORDERS } from './orders.queries';

describe('GET_ORDERS list timing fields', () => {
  const query = String(GET_ORDERS);

  it('returns pickup deadlines used by agent Active Orders', () => {
    expect(query).toContain('pickup_by');
    expect(query).toContain('pickup_due_at');
  });

  it('returns scheduled delivery window and promised fields for deliver-by', () => {
    expect(query).toContain('fulfillment_timing');
    expect(query).toContain('estimated_delivery_time');
    expect(query).toContain('promised_fulfill_by');
    expect(query).toMatch(/delivery_time_windows[\s\S]*time_slot_end/);
    expect(query).toMatch(/delivery_time_windows[\s\S]*preferred_date/);
  });
});
