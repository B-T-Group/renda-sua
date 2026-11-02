import { describe, expect, it } from 'vitest';
import {
  itemModerationDefaultLabel,
  itemModerationLabelKey,
} from './itemStatusUi';

describe('itemStatusUi recovery labels', () => {
  it('shows Needs changes for a typical rejected item', () => {
    expect(itemModerationDefaultLabel('rejected', { category: 'photo_quality' })).toBe(
      'Needs changes'
    );
    expect(itemModerationLabelKey('rejected')).toBe(
      'business.items.recovery.status.needsChanges'
    );
  });

  it('shows Not allowed for prohibited items', () => {
    expect(
      itemModerationDefaultLabel('rejected', { category: 'prohibited_item' })
    ).toBe('Not allowed');
  });

  it('shows In review after resubmit', () => {
    expect(
      itemModerationDefaultLabel('pending', { pendingResubmit: true })
    ).toBe('In review · usually within 24 h');
  });
});
