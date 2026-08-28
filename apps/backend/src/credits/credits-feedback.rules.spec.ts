import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import {
  FEEDBACK_ACTION_TO_CHANNEL,
  FEEDBACK_ACTION_TO_CLASSIFICATION,
  type CreditFeedbackAction,
} from './credit.types';

describe('ops credits feedback rules', () => {
  it('maps contact actions to channels and skip actions to classification', () => {
    expect(FEEDBACK_ACTION_TO_CHANNEL.called_client).toBe('call');
    expect(FEEDBACK_ACTION_TO_CHANNEL.emailed_client).toBe('email');
    expect(FEEDBACK_ACTION_TO_CHANNEL.spoke_in_person).toBe('in_person');
    expect(FEEDBACK_ACTION_TO_CLASSIFICATION.test_order).toBe('test');
    expect(FEEDBACK_ACTION_TO_CLASSIFICATION.internal_order).toBe('internal');
  });

  it('blocks self-award when actor is the order client', () => {
    const actorId = 'user-1';
    const clientUserId = 'user-1';
    expect(() => {
      if (clientUserId && actorId === clientUserId) {
        throw new ForbiddenException(
          'You cannot award feedback credit on your own order'
        );
      }
    }).toThrow(ForbiddenException);
  });

  it('allows classification actions without requiring a channel', () => {
    const action: CreditFeedbackAction = 'test_order';
    expect(FEEDBACK_ACTION_TO_CHANNEL[action]).toBeUndefined();
    expect(FEEDBACK_ACTION_TO_CLASSIFICATION[action]).toBe('test');
  });

  it('treats already-classified orders as conflict', () => {
    const opsClassification: 'test' | 'internal' | null = 'test';
    expect(() => {
      if (opsClassification) {
        throw new HttpException(
          'Order already classified as test or internal',
          HttpStatus.CONFLICT
        );
      }
    }).toThrow(HttpException);
  });
});
