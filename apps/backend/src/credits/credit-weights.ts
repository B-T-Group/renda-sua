import type { CreditEventType } from './credit.types';

/** Snapshotted onto user_credits.weight at award time. */
export const CREDIT_WEIGHTS: Record<CreditEventType, number> = {
  my_first_purchase: 1,
  cancelled_feedback: 3,
  first_order_completed_feedback: 4,
  escalation_resolved: 5,
  agent_referred: 8,
  business_referred: 15,
};

export const CREDIT_FEEDBACK_WINDOW_DAYS = 14;
