import { CREDIT_WEIGHTS } from './credit-weights';

describe('CREDIT_WEIGHTS', () => {
  it('assigns the planned weights', () => {
    expect(CREDIT_WEIGHTS.my_first_purchase).toBe(1);
    expect(CREDIT_WEIGHTS.cancelled_feedback).toBe(3);
    expect(CREDIT_WEIGHTS.first_order_completed_feedback).toBe(4);
    expect(CREDIT_WEIGHTS.escalation_resolved).toBe(5);
    expect(CREDIT_WEIGHTS.agent_referred).toBe(8);
    expect(CREDIT_WEIGHTS.business_referred).toBe(15);
  });
});
