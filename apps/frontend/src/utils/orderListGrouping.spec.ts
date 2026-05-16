import { partitionOrdersByActivity } from './orderListGrouping';

describe('partitionOrdersByActivity', () => {
  it('splits active, completed, and cancelled orders', () => {
    const orders = [
      { id: '1', current_status: 'preparing' },
      { id: '2', current_status: 'picked_up' },
      { id: '3', current_status: 'complete' },
      { id: '4', current_status: 'delivered' },
      { id: '5', current_status: 'cancelled' },
      { id: '6', current_status: 'failed' },
    ];

    const result = partitionOrdersByActivity(orders);

    expect(result.active.map((o) => o.id)).toEqual(['1', '2']);
    expect(result.completed.map((o) => o.id)).toEqual(['3', '4']);
    expect(result.cancelled.map((o) => o.id)).toEqual(['5', '6']);
  });
});
