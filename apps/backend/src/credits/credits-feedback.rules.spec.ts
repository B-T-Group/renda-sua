import {
  FEEDBACK_ACTION_TO_CHANNEL,
  FEEDBACK_ACTION_TO_CLASSIFICATION,
  type CreditFeedbackAction,
} from './credit.types';

describe('ops credits feedback rules', () => {
  it('maps contact actions to channels and skip actions to classification', () => {
    expect(FEEDBACK_ACTION_TO_CHANNEL.called_client).toBe('call');
    expect(FEEDBACK_ACTION_TO_CHANNEL.called_business).toBe('call');
    expect(FEEDBACK_ACTION_TO_CHANNEL.emailed_client).toBe('email');
    expect(FEEDBACK_ACTION_TO_CHANNEL.spoke_in_person).toBe('in_person');
    expect(FEEDBACK_ACTION_TO_CLASSIFICATION.test_order).toBe('test');
    expect(FEEDBACK_ACTION_TO_CLASSIFICATION.internal_order).toBe('internal');
  });

  it('allows classification actions without requiring a channel', () => {
    const action: CreditFeedbackAction = 'test_order';
    expect(FEEDBACK_ACTION_TO_CHANNEL[action]).toBeUndefined();
    expect(FEEDBACK_ACTION_TO_CLASSIFICATION[action]).toBe('test');
  });
});
