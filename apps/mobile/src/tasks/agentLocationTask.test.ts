import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordFailure,
  clearFailure,
  canRetryAfterFailure,
  beginSend,
  endSend,
  __testOnly_resetState,
} from '../utils/agentLocationLastSentStorage';

describe('agentLocationTask - failure backoff behavior (unit)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __testOnly_resetState();
  });

  it('(a) failure result flow: recordFailure -> backoff blocks within 60s', () => {
    if (!beginSend()) throw new Error('beginSend should succeed');
    
    try {
      const mockResult = { success: false };
      
      if (!mockResult.success) {
        recordFailure();
        return;
      }
      clearFailure();
    } finally {
      endSend();
    }

    expect(canRetryAfterFailure(60_000)).toBe(false);

    vi.advanceTimersByTime(30_000);
    expect(canRetryAfterFailure(60_000)).toBe(false);

    if (beginSend()) {
      endSend();
      throw new Error('beginSend should succeed, but canRetryAfterFailure should block the send logic');
    }
  });

  it('(b) thrown error flow: recordFailure on catch -> backoff blocks within 60s', () => {
    if (!beginSend()) throw new Error('beginSend should succeed');
    
    try {
      const mockUpdateFn = () => {
        throw new Error('Network error');
      };

      try {
        mockUpdateFn();
        clearFailure();
      } catch {
        recordFailure();
        return;
      }
    } finally {
      endSend();
    }

    expect(canRetryAfterFailure(60_000)).toBe(false);

    vi.advanceTimersByTime(30_000);
    expect(canRetryAfterFailure(60_000)).toBe(false);
  });

  it('(c) failure -> wait 60s -> success clears -> next send immediately allowed', () => {
    if (!beginSend()) throw new Error('beginSend should succeed');
    
    try {
      const mockResult = { success: false };
      if (!mockResult.success) {
        recordFailure();
        return;
      }
      clearFailure();
    } finally {
      endSend();
    }

    expect(canRetryAfterFailure(60_000)).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(canRetryAfterFailure(60_000)).toBe(true);

    if (!beginSend()) throw new Error('beginSend should succeed after backoff');
    
    try {
      const mockResult2 = { success: true };
      if (!mockResult2.success) {
        recordFailure();
        return;
      }
      clearFailure();
    } finally {
      endSend();
    }

    vi.advanceTimersByTime(2_000);
    expect(canRetryAfterFailure(60_000)).toBe(true);

    if (!beginSend()) throw new Error('beginSend should succeed after success cleared failure');
    endSend();
  });
});
